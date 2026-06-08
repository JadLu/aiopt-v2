import { NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";

const KIE_AI_CHAT_API = "https://api.kie.ai/codex/v1/responses";

const SYSTEM_PROMPT = `You are an expert Meta Ads strategist embedded inside an AI-powered advertising command center for MENA (Middle East & North Africa) e-commerce brands.

Your role is to help advertisers interpret their Meta campaign data, diagnose performance issues, and suggest concrete optimizations. You have access to the user's live campaign metrics (injected as context in each request).

Your expertise covers:
- Meta Ads campaign structure, optimization strategies, and budget management
- MENA performance benchmarks: typical ROAS 2–6x, CPA varies widely by category and country
- Audience targeting and creative fatigue detection (frequency > 3.5 is high)
- Campaign health diagnosis using ROAS, CPA, CTR, and frequency
- Seasonal buying patterns: Ramadan, Eid, White Friday, National Day campaigns
- Gulf vs. North Africa consumer behavior differences
- Scaling strategies: horizontal (new audiences) vs. vertical (budget increases)
- Budget pacing, bid strategy, and delivery optimization
- Creative best practices for Arabic-speaking audiences

When given campaign data:
- Identify the biggest performance issue first
- Give specific, actionable recommendations (not generic advice)
- Reference the user's actual numbers when possible
- Keep answers concise and structured — use short bullet lists for action steps
- If something looks healthy, say so briefly, then focus on what can improve

Tone: confident, direct, data-driven. Like a senior media buyer reviewing the account.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CampaignContext {
  totalSpend: number;
  avgRoas: number;
  activeCampaigns: number;
  openAlerts: number;
  campaigns: {
    name: string;
    status: string;
    spend: number;
    roas: number;
    cpa: number;
    ctr: number;
    frequency: number;
    healthTier: string;
    healthScore: number;
  }[];
}

export async function POST(request: NextRequest) {
  try { await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  let messages: ChatMessage[];
  let context: CampaignContext | null;

  try {
    const body = await request.json() as { messages: ChatMessage[]; context: CampaignContext | null };
    messages = body.messages;
    context = body.context;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!messages?.length) {
    return new Response("No messages provided", { status: 400 });
  }

  const contextBlock = context
    ? `\n\n--- LIVE ACCOUNT DATA ---\nTotal Spend (30d): $${context.totalSpend.toFixed(2)}\nAvg ROAS: ${context.avgRoas.toFixed(2)}x\nActive Campaigns: ${context.activeCampaigns}\nOpen Alerts: ${context.openAlerts}\n\nCampaigns:\n${context.campaigns
        .map(
          (c) =>
            `• ${c.name} [${c.status}] — Spend $${c.spend.toFixed(0)}, ROAS ${c.roas.toFixed(2)}x, CPA $${c.cpa.toFixed(2)}, CTR ${c.ctr.toFixed(2)}%, Freq ${c.frequency.toFixed(1)}, Health: ${c.healthScore}/100 (${c.healthTier})`
        )
        .join("\n")}\n--- END DATA ---`
    : "";

  const input = [
    {
      role: "developer",
      content: [{ type: "input_text", text: SYSTEM_PROMPT + contextBlock }],
    },
    ...messages.map((m) => ({
      role: m.role,
      content: [
        {
          type: m.role === "user" ? "input_text" : "output_text",
          text: m.content,
        },
      ],
    })),
  ];

  const upstream = await fetch(KIE_AI_CHAT_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-5",
      stream: true,
      input,
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(`API error: ${errText}`, { status: upstream.status });
  }

  if (!upstream.body) {
    return new Response("Empty response from API", { status: 502 });
  }

  const encoder = new TextEncoder();
  const upstreamReader = upstream.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trim();
              if (dataStr === "[DONE]") {
                controller.close();
                return;
              }
              if (currentEvent === "response.output_text.delta") {
                try {
                  const parsed = JSON.parse(dataStr) as { delta?: string };
                  if (parsed.delta) {
                    controller.enqueue(encoder.encode(parsed.delta));
                  }
                } catch {
                  // skip malformed
                }
              }
            } else if (line === "") {
              currentEvent = "";
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        upstreamReader.releaseLock();
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

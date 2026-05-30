import { NextRequest } from "next/server";

const KIE_AI_API = "https://api.kie.ai/codex/v1/responses";

const SYSTEM_PROMPT = `You are an expert marketing strategist specializing in MENA (Middle East and North Africa) e-commerce. You understand the unique cultural dynamics, consumer behaviors, and digital ecosystems of markets including Saudi Arabia, UAE, Egypt, Morocco, Kuwait, Bahrain, Qatar, Oman, Jordan, Lebanon, and Tunisia.

Your expertise covers:
- MENA consumer psychology, cultural sensitivities, and regional purchasing patterns
- High-performing digital advertising platforms in the region: Meta (Facebook/Instagram), TikTok, Snapchat, Google Ads
- Influencer marketing landscape across the Gulf, Levant, and North Africa
- Seasonal strategies: Ramadan, Eid, White Friday, and National Day campaigns
- Bilingual marketing (Arabic/English) and RTL content considerations
- Regional e-commerce platforms: Noon, Amazon.ae, Namshi, Jumia, Zid, Salla
- Performance benchmarks: CPA, ROAS, CPM, CTR specific to MENA markets
- Payment preferences: cash-on-delivery (COD) in Egypt and Morocco vs. card payments in Gulf states
- Shipping and logistics nuances by country

Generate comprehensive, actionable, data-driven marketing plans tailored to the specific MENA country and product. Always structure plans with clear sections, specific platforms and tactics, budget recommendations, and measurable goals aligned with the given performance targets.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  let project: {
    name: string;
    description: string;
    country: string;
    targetCpa: number;
    targetRoas: number;
    emoji: string;
    productImageUrl?: string;
  };

  try {
    const body = await request.json();
    project = body.project;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!project?.name || !project?.country) {
    return new Response("Missing required project fields", { status: 400 });
  }

  const upstream = await fetch(KIE_AI_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-5",
      stream: true,
      reasoning: { effort: "high" },
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: SYSTEM_PROMPT }],
        },
        {
          role: "user",
          content: [
            ...(project.productImageUrl
              ? [{ type: "input_image" as const, image_url: project.productImageUrl }]
              : []),
            {
              type: "input_text",
              text: `Generate a comprehensive marketing plan for this e-commerce product:

Product: ${project.emoji} ${project.name}
Description: ${project.description || "Not provided"}
Target Market: ${project.country}
Performance Targets: CPA ≤ $${project.targetCpa} | ROAS ≥ ${project.targetRoas}x

Structure your plan with these sections:
1. Market & Audience Analysis (${project.country}-specific insights)
2. Marketing Channels & Budget Allocation
3. Content & Creative Strategy
4. Campaign Phases (Awareness → Testing → Scaling)
5. Key Performance Indicators & Benchmarks
6. 30-Day Action Plan (prioritized quick wins)

Be specific: name exact platforms, ad formats, audience segments, and realistic budget splits. Align all recommendations with the CPA and ROAS targets.`,
            },
          ],
        },
      ],
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
                  // skip malformed JSON
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

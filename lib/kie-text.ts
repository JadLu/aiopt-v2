// Server-only: streamed text generation through the KIE AI "responses" endpoint.
// Shared by the marketing-plan and regenerate-angle routes.

const KIE_AI_API = "https://api.kie.ai/codex/v1/responses";

export interface CollectTextOptions {
  system: string;
  user: string;
  imageUrl?: string;
  effort?: "low" | "medium" | "high";
  /** Called after every text delta with the full text so far and the new delta. */
  onText?: (fullText: string, delta: string) => void;
}

/** Consumes the KIE SSE stream to completion and returns the accumulated text. */
export async function collectResponseText(apiKey: string, opts: CollectTextOptions): Promise<string> {
  const upstream = await fetch(KIE_AI_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-5",
      stream: true,
      reasoning: { effort: opts.effort ?? "medium" },
      input: [
        { role: "developer", content: [{ type: "input_text", text: opts.system }] },
        {
          role: "user",
          content: [
            ...(opts.imageUrl ? [{ type: "input_image" as const, image_url: opts.imageUrl }] : []),
            { type: "input_text", text: opts.user },
          ],
        },
      ],
    }),
  });

  if (!upstream.ok) throw new Error(`KIE API error (${upstream.status})`);
  if (!upstream.body) throw new Error("Empty response from KIE API");

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const dataStr = line.slice(5).trim();
        if (dataStr === "[DONE]") return fullText;
        if (currentEvent === "response.output_text.delta") {
          try {
            const parsed = JSON.parse(dataStr) as { delta?: string };
            if (parsed.delta) {
              fullText += parsed.delta;
              opts.onText?.(fullText, parsed.delta);
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

  return fullText;
}

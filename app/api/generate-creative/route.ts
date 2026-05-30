import { NextRequest } from "next/server";

const KIE_AI_BASE = "https://api.kie.ai";

export async function POST(request: NextRequest) {
  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  let body: { prompt: string; aspectRatio?: string; resolution?: string; imageInput?: string[] };
  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return new Response("Prompt is required", { status: 400 });
  }

  const createTaskBody: Record<string, unknown> = {
    model: "nano-banana-2",
    input: {
      prompt:        body.prompt,
      image_input:   body.imageInput ?? [],
      aspect_ratio:  body.aspectRatio ?? "1:1",
      resolution:    body.resolution ?? "1K",
      output_format: "jpg",
    },
  };

  const upstream = await fetch(`${KIE_AI_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createTaskBody),
  });

  const data = await upstream.json() as { code: number; msg: string; data?: Record<string, unknown> };
  console.log("[generate-creative] createTask response:", JSON.stringify(data));

  const taskId = data.data?.taskId as string | undefined;

  if (data.code !== 200 || !taskId) {
    return Response.json({ error: data.msg || "Generation failed" }, { status: 500 });
  }

  return Response.json({ taskId });
}

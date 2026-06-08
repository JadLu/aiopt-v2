import { NextRequest } from "next/server";

const KIE_AI_BASE = "https://api.kie.ai";

export async function POST(request: NextRequest) {
  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  let body: { prompt: string; aspectRatio?: string; duration?: string; resolution?: string; imageUrls?: string[] };
  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return new Response("Prompt is required", { status: 400 });
  }

  const createTaskBody: Record<string, unknown> = {
    model: "gemini-omni-video",
    input: {
      prompt:       body.prompt,
      image_urls:   body.imageUrls ?? [],
      aspect_ratio: body.aspectRatio ?? "9:16",
      duration:     body.duration ?? "8",
      resolution:   body.resolution ?? "720p",
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
  console.log("[generate-video] createTask response:", JSON.stringify(data));

  const taskId = data.data?.taskId as string | undefined;

  if (data.code !== 200 || !taskId) {
    return Response.json({ error: data.msg || "Video generation failed" }, { status: 500 });
  }

  return Response.json({ taskId });
}

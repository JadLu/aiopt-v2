import { type NextRequest } from "next/server";
import { handleJobStatus } from "@/lib/job-status";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleJobStatus(request, "video", "videoUrl");
}

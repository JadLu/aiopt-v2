import { NextRequest, NextResponse } from "next/server";

type CampaignAction = "PAUSE" | "ACTIVE";

interface ActionBody {
  campaignId: string;
  action: CampaignAction;
  accessToken: string;
}

export async function POST(request: NextRequest) {
  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { campaignId, action, accessToken } = body;

  if (!campaignId || !action || !accessToken) {
    return NextResponse.json(
      { error: "campaignId, action, and accessToken are required" },
      { status: 400 }
    );
  }

  const status = action === "PAUSE" ? "PAUSED" : "ACTIVE";

  const res = await fetch(
    `https://graph.facebook.com/v22.0/${campaignId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, access_token: accessToken }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Campaign action error:", err);
    return NextResponse.json(
      { error: "Meta API rejected the action" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, campaignId, newStatus: status });
}

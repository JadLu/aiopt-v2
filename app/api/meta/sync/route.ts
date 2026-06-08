import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";
import { computeHealthScore } from "@/lib/advertising-utils";
import type { MetaCampaign } from "@/lib/firebase/meta-campaigns";

interface MetaInsight {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
}

interface MetaCampaignRaw {
  id: string;
  name: string;
  status: string;
  objective: string;
  insights?: { data: MetaInsight[] };
}

interface SyncBody {
  uid: string;
  accountId: string;
  accessToken: string;
  targetRoas: number;
  targetCpa: number;
}

function parseNum(v: string | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

function extractInsights(
  raw: MetaCampaignRaw,
  accountId: string,
  targetRoas: number,
  targetCpa: number
): MetaCampaign {
  const insight: MetaInsight = raw.insights?.data?.[0] ?? {};

  const spend = parseNum(insight.spend);
  const impressions = parseNum(insight.impressions);
  const clicks = parseNum(insight.clicks);
  const ctr = parseNum(insight.ctr);
  const cpm = parseNum(insight.cpm);
  const cpc = parseNum(insight.cpc);
  const frequency = parseNum(insight.frequency);

  const purchases =
    parseNum(
      insight.actions?.find((a) => a.action_type === "purchase")?.value
    ) || 0;

  const roasEntry = insight.purchase_roas?.find(
    (r) => r.action_type === "omni_purchase"
  );
  const roas = parseNum(roasEntry?.value);

  const cpaEntry = insight.cost_per_action_type?.find(
    (c) => c.action_type === "purchase"
  );
  const cpa = parseNum(cpaEntry?.value);

  const { score, tier } = computeHealthScore(
    { roas, cpa, ctr, frequency },
    { targetRoas, targetCpa }
  );

  return {
    id: raw.id,
    accountId,
    name: raw.name,
    status: raw.status as MetaCampaign["status"],
    objective: raw.objective ?? "",
    spend,
    impressions,
    clicks,
    ctr,
    cpm,
    cpc,
    purchases,
    roas,
    cpa,
    frequency,
    healthScore: score,
    healthTier: tier,
    syncedAt: new Date().toISOString(),
  };
}

async function fetchCampaigns(
  accountId: string,
  accessToken: string
): Promise<MetaCampaignRaw[]> {
  const fields = [
    "id",
    "name",
    "status",
    "objective",
    "insights.date_preset(last_30d){spend,impressions,clicks,ctr,cpm,cpc,frequency,actions,cost_per_action_type,purchase_roas}",
  ].join(",");

  const url = new URL(
    `https://graph.facebook.com/v22.0/${accountId}/campaigns`
  );
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", "100");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta campaigns fetch failed: ${err}`);
  }
  const data = (await res.json()) as { data: MetaCampaignRaw[] };
  return data.data ?? [];
}

export async function POST(request: NextRequest) {
  let verifiedUid: string;
  try { verifiedUid = await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Use uid from verified token — never trust the uid from the request body.
  const { accountId, accessToken, targetRoas, targetCpa } = body;
  const uid = verifiedUid;

  if (!accountId || !accessToken) {
    return NextResponse.json(
      { error: "uid, accountId and accessToken are required" },
      { status: 400 }
    );
  }

  try {
    const rawCampaigns = await fetchCampaigns(accountId, accessToken);

    const campaigns = rawCampaigns.map((raw) =>
      extractInsights(raw, accountId, targetRoas ?? 2.5, targetCpa ?? 50)
    );

    return NextResponse.json({
      campaigns,
      campaignCount: campaigns.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Meta sync error:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

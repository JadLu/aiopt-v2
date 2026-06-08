"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  RefreshCw,
  Settings2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Check,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import {
  subscribeToMetaAccounts,
  createMetaAccount,
  updateMetaAccount,
  type MetaAccount,
} from "@/lib/firebase/meta-accounts";
import {
  subscribeToAllMetaCampaigns,
  upsertMetaCampaigns,
  type MetaCampaign,
} from "@/lib/firebase/meta-campaigns";
import {
  subscribeToAdAlerts,
  resolveAdAlert,
  type AdAlert,
} from "@/lib/firebase/ad-alerts";
import {
  subscribeToAlertRules,
  createAlertRule,
  deleteAlertRule,
  type AlertRule,
  type CreateAlertRuleInput,
} from "@/lib/firebase/alert-rules";
import { isStale } from "@/lib/advertising-utils";
import { ConnectMetaBanner } from "@/components/advertising/connect-meta-banner";
import { StatsBar } from "@/components/advertising/stats-bar";
import { CampaignTable } from "@/components/advertising/campaign-table";
import { AlertsFeed } from "@/components/advertising/alerts-feed";
import { AlertRulesDialog } from "@/components/advertising/alert-rules-dialog";
import { AiChat } from "@/components/advertising/ai-chat";

type Tab = "campaigns" | "alerts" | "rules";

// toast helper ─────────────────────────────────────────────────────────────────
function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        padding: "12px 18px",
        borderRadius: "var(--radius-md)",
        background: type === "success" ? "var(--success)" : "var(--danger)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
      }}
    >
      {type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {message}
    </div>
  );
}

function AdvertisingPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [alerts, setAlerts] = useState<AdAlert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  // tracks which account IDs have been auto-synced this session
  const syncedAccountIds = useRef(new Set<string>());

  const [activeTab, setActiveTab] = useState<Tab>("campaigns");
  const [syncing, setSyncing] = useState(false);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  const uid = user?.uid;

  // ── Toast helper ─────────────────────────────────────────────────────────────
  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Handle OAuth callback params ──────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (error) {
      showToast(`Connection failed: ${error}`, "error");
      router.replace("/advertising");
      return;
    }

    if (connected === "true") {
      (async () => {
        // Token data is stored in a short-lived httpOnly cookie by the callback
        // route — never passed via URL to avoid browser history / log exposure.
        const res = await fetch("/api/auth/meta/session");
        const data = await res.json() as {
          token: string;
          expires: string;
          accounts: { id: string; name: string }[];
        } | null;

        if (!data?.token || !data.expires || !data.accounts) {
          showToast("Failed to retrieve session data", "error");
          router.replace("/advertising");
          return;
        }

        for (const acc of data.accounts) {
          await createMetaAccount(uid, {
            id: acc.id,
            name: acc.name,
            accessToken: data.token,
            tokenExpiresAt: data.expires,
          });
        }
        if (data.accounts.length > 0) setSelectedAccountId(data.accounts[0].id);
        showToast("Meta account connected successfully!");
        router.replace("/advertising");
      })();
    }
  }, [uid, searchParams, router]);

  // ── Subscribe to Firebase collections ────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToMetaAccounts(uid, (data) => {
      setAccounts(data);
      setAccountsLoaded(true);
    });
    return unsub;
  }, [uid]);

  // Init selectedAccountId to first account when accounts first arrive
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToAllMetaCampaigns(uid, setCampaigns);
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToAdAlerts(uid, setAlerts);
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToAlertRules(uid, setRules);
    return unsub;
  }, [uid]);

  // ── Close picker on outside click ────────────────────────────────────────────
  useEffect(() => {
    if (!accountPickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setAccountPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [accountPickerOpen]);

  // ── Sync function ─────────────────────────────────────────────────────────────
  const sync = useCallback(
    async (account: MetaAccount) => {
      if (!uid || syncing) return;
      setSyncing(true);
      try {
        const res = await fetch("/api/meta/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid,
            accountId: account.id,
            accessToken: account.accessToken,
            targetRoas: account.targetRoas,
            targetCpa: account.targetCpa,
          }),
        });

        if (!res.ok) throw new Error("Sync request failed");

        const data = (await res.json()) as {
          campaigns: MetaCampaign[];
          syncedAt: string;
        };

        await upsertMetaCampaigns(uid, data.campaigns);
        await updateMetaAccount(uid, account.id, {
          lastSyncedAt: data.syncedAt,
        });

        // Evaluate alert rules against fresh campaign data
        await evaluateAlertRules(data.campaigns);
      } catch (err) {
        console.error("Sync error:", err);
        showToast("Sync failed — check your connection", "error");
      } finally {
        setSyncing(false);
      }
    },
    [uid, syncing]
  );

  // ── Auto-sync on account switch if stale ─────────────────────────────────────
  const account = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;

  useEffect(() => {
    if (!account || syncedAccountIds.current.has(account.id)) return;
    syncedAccountIds.current.add(account.id);
    if (isStale(account.lastSyncedAt)) {
      sync(account);
    }
  }, [account, sync]);

  // ── Alert rule evaluation ─────────────────────────────────────────────────────
  async function evaluateAlertRules(freshCampaigns: MetaCampaign[]) {
    if (!uid || rules.length === 0) return;

    const metricValue = (campaign: MetaCampaign, metric: string): number => {
      const map: Record<string, number> = {
        ROAS: campaign.roas,
        CPA: campaign.cpa,
        CTR: campaign.ctr,
        frequency: campaign.frequency,
        spend: campaign.spend,
      };
      return map[metric] ?? 0;
    };

    const { createAdAlert: createAlert } = await import("@/lib/firebase/ad-alerts");

    for (const rule of rules) {
      if (!rule.enabled) continue;
      const targets =
        rule.scope === "campaign" && rule.campaignId
          ? freshCampaigns.filter((c) => c.id === rule.campaignId)
          : freshCampaigns;

      for (const campaign of targets) {
        const val = metricValue(campaign, rule.metric);
        const violated =
          rule.operator === ">" ? val > rule.threshold : val < rule.threshold;
        if (violated) {
          await createAlert(uid, {
            ruleId: rule.id,
            campaignId: campaign.id,
            campaignName: campaign.name,
            metric: rule.metric,
            value: val,
            threshold: rule.threshold,
            tier: rule.tier,
          });
        }
      }
    }
  }

  // ── Campaign status update (optimistic) ──────────────────────────────────────
  function handleCampaignUpdated(
    campaignId: string,
    newStatus: MetaCampaign["status"]
  ) {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaignId ? { ...c, status: newStatus } : c))
    );
  }

  // ── Connect another account ───────────────────────────────────────────────────
  async function handleConnectAnother() {
    setAccountPickerOpen(false);
    try {
      const res = await fetch("/api/auth/meta");
      const data = (await res.json()) as { url?: string; error?: string };
      if (!data.url) throw new Error(data.error ?? "Failed to get auth URL");
      window.location.href = data.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Connection failed", "error");
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (!uid) return null;
  if (!accountsLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <RefreshCw size={20} style={{ color: "var(--text-tertiary)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  // Campaigns and alerts scoped to the selected account
  const accountCampaigns = account
    ? campaigns.filter((c) => c.accountId === account.id)
    : [];

  return (
    <div className="app-content">
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
            Advertising
          </h1>

          {/* Account switcher */}
          {account && (
            <div ref={pickerRef} style={{ position: "relative", marginTop: 6 }}>
              <button
                onClick={() => setAccountPickerOpen((o) => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: "var(--r-input)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {account.name}
                </span>
                <span style={{ color: "var(--text-tertiary)" }}>·</span>
                <span>
                  {account.lastSyncedAt
                    ? `Last synced ${new Date(account.lastSyncedAt).toLocaleTimeString()}`
                    : "Not yet synced"}
                </span>
                <ChevronDown
                  size={13}
                  style={{
                    color: "var(--text-tertiary)",
                    transform: accountPickerOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s var(--ease)",
                    flexShrink: 0,
                  }}
                />
              </button>

              {accountPickerOpen && (
                <div
                  className="card"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    minWidth: 256,
                    zIndex: 200,
                    padding: 6,
                    boxShadow: "var(--card-shadow)",
                  }}
                >
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setAccountPickerOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: "var(--r-input)",
                        border: "none",
                        background:
                          acc.id === selectedAccountId
                            ? "var(--bg-subtle)"
                            : "transparent",
                        color: "var(--text-primary)",
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{acc.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
                          {acc.id}
                        </div>
                      </div>
                      {acc.id === selectedAccountId && (
                        <Check
                          size={14}
                          style={{ color: "var(--accent-primary)", flexShrink: 0 }}
                        />
                      )}
                    </button>
                  ))}

                  <div
                    style={{
                      borderTop: "1px solid var(--border-default)",
                      margin: "4px 0",
                    }}
                  />

                  <button
                    onClick={handleConnectAnother}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: "var(--r-input)",
                      border: "none",
                      background: "transparent",
                      color: "var(--accent-primary)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} />
                    Connect another account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {account && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setShowRulesDialog(true)}
              className="btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <Settings2 size={14} />
              Alert Rules
            </button>
            <button
              onClick={() => sync(account)}
              disabled={syncing}
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              <RefreshCw
                size={14}
                style={{ animation: syncing ? "spin 1s linear infinite" : "none" }}
              />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>
        )}
      </div>

      {/* No account connected */}
      {!account && (
        <div className="card" style={{ padding: 0 }}>
          <ConnectMetaBanner
            onConnected={(token, expires, accs) => {
              if (!uid) return;
              accs.forEach((a) =>
                createMetaAccount(uid, {
                  id: a.id,
                  name: a.name,
                  accessToken: token,
                  tokenExpiresAt: expires,
                })
              );
            }}
          />
        </div>
      )}

      {/* Account connected */}
      {account && (
        <>
          <StatsBar campaigns={accountCampaigns} alerts={alerts} />

          {/* Tabs */}
          <div className="auth-tabs" style={{ marginBottom: 20 }}>
            {(["campaigns", "alerts", "rules"] as Tab[]).map((tab) => (
              <button
                key={tab}
                className={`auth-tab${activeTab === tab ? " active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "campaigns" && `Campaigns (${accountCampaigns.length})`}
                {tab === "alerts" && `Alerts (${alerts.length})`}
                {tab === "rules" && `Rules (${rules.length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="card" style={{ padding: 0 }}>
            {activeTab === "campaigns" && (
              <CampaignTable
                campaigns={accountCampaigns}
                accessToken={account.accessToken}
                onCampaignUpdated={handleCampaignUpdated}
              />
            )}
            {activeTab === "alerts" && (
              <div style={{ padding: 16 }}>
                <AlertsFeed
                  alerts={alerts}
                  onResolve={(id) => resolveAdAlert(uid, id)}
                />
              </div>
            )}
            {activeTab === "rules" && (
              <div style={{ padding: 16 }}>
                {rules.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32 }}>
                    <p style={{ color: "var(--text-tertiary)", fontSize: 14, marginBottom: 12 }}>
                      No alert rules configured yet.
                    </p>
                    <button
                      onClick={() => setShowRulesDialog(true)}
                      className="btn-primary"
                      style={{ fontSize: 13 }}
                    >
                      Add Your First Rule
                    </button>
                  </div>
                ) : (
                  <AlertsFeed alerts={[]} onResolve={() => {}} />
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Alert Rules Dialog */}
      {showRulesDialog && (
        <AlertRulesDialog
          rules={rules}
          campaigns={accountCampaigns.map((c) => ({ id: c.id, name: c.name }))}
          onAdd={(input) => createAlertRule(uid, input).then(() => void 0)}
          onDelete={(id) => deleteAlertRule(uid, id)}
          onClose={() => setShowRulesDialog(false)}
        />
      )}

      {/* AI Chat */}
      <AiChat campaigns={accountCampaigns} alerts={alerts} />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

export default function AdvertisingPage() {
  return (
    <Suspense
      fallback={
        <div className="app-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <RefreshCw size={20} style={{ color: "var(--text-tertiary)", animation: "spin 1s linear infinite" }} />
        </div>
      }
    >
      <AdvertisingPageInner />
    </Suspense>
  );
}

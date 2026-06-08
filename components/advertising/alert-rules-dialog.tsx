"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { AlertRule, CreateAlertRuleInput, AlertMetric, AlertOperator, AlertTier } from "@/lib/firebase/alert-rules";

interface Props {
  rules: AlertRule[];
  campaigns: { id: string; name: string }[];
  onAdd: (input: CreateAlertRuleInput) => Promise<void>;
  onDelete: (ruleId: string) => Promise<void>;
  onClose: () => void;
}

const METRICS: { value: AlertMetric; label: string }[] = [
  { value: "ROAS",      label: "ROAS" },
  { value: "CPA",       label: "Cost per Acquisition (CPA)" },
  { value: "CTR",       label: "Click-through Rate (CTR %)" },
  { value: "frequency", label: "Ad Frequency" },
  { value: "spend",     label: "Total Spend ($)" },
];

const defaultForm: CreateAlertRuleInput = {
  metric: "ROAS",
  operator: "<",
  threshold: 2,
  tier: "yellow",
  scope: "account",
  campaignId: undefined,
};

export function AlertRulesDialog({ rules, campaigns, onAdd, onDelete, onClose }: Props) {
  const [form, setForm] = useState<CreateAlertRuleInput>(defaultForm);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof CreateAlertRuleInput>(
    key: K,
    value: CreateAlertRuleInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAdd() {
    setSaving(true);
    try {
      await onAdd(form);
      setForm(defaultForm);
    } finally {
      setSaving(false);
    }
  }

  const metricLabels: Record<AlertMetric, string> = {
    ROAS: "ROAS",
    CPA: "CPA",
    CTR: "CTR %",
    frequency: "Frequency",
    spend: "Spend $",
  };

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="dialog-panel"
        style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            Alert Rules
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* New Rule Form */}
        <div
          style={{
            padding: 16,
            borderRadius: "var(--radius-md)",
            background: "var(--bg-subtle)",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
            NEW RULE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 10, marginBottom: 10 }}>
            <select
              value={form.metric}
              onChange={(e) => update("metric", e.target.value as AlertMetric)}
              className="auth-input"
              style={{ fontSize: 13 }}
            >
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={form.operator}
              onChange={(e) => update("operator", e.target.value as AlertOperator)}
              className="auth-input"
              style={{ fontSize: 13 }}
            >
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
            </select>
            <input
              type="number"
              value={form.threshold}
              onChange={(e) => update("threshold", parseFloat(e.target.value) || 0)}
              className="auth-input"
              style={{ fontSize: 13 }}
              min="0"
              step="0.1"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <select
              value={form.tier}
              onChange={(e) => update("tier", e.target.value as AlertTier)}
              className="auth-input"
              style={{ fontSize: 13 }}
            >
              <option value="yellow">Yellow (Warning)</option>
              <option value="red">Red (Critical)</option>
            </select>
            <select
              value={form.scope}
              onChange={(e) => {
                update("scope", e.target.value as "account" | "campaign");
                if (e.target.value === "account") update("campaignId", undefined);
              }}
              className="auth-input"
              style={{ fontSize: 13 }}
            >
              <option value="account">All campaigns</option>
              <option value="campaign">Specific campaign</option>
            </select>
          </div>
          {form.scope === "campaign" && (
            <select
              value={form.campaignId ?? ""}
              onChange={(e) => update("campaignId", e.target.value || undefined)}
              className="auth-input"
              style={{ fontSize: 13, width: "100%", marginBottom: 12 }}
            >
              <option value="">Select campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <Plus size={14} />
            {saving ? "Adding…" : "Add Rule"}
          </button>
        </div>

        {/* Existing Rules */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rules.length === 0 && (
            <div style={{ color: "var(--text-tertiary)", fontSize: 13, textAlign: "center", padding: 16 }}>
              No rules yet. Add one above.
            </div>
          )}
          {rules.map((rule) => (
            <div
              key={rule.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-elevated)",
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                  {metricLabels[rule.metric]} {rule.operator} {rule.threshold}
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 99,
                    background:
                      rule.tier === "red"
                        ? "rgba(229,118,118,0.15)"
                        : "rgba(232,181,71,0.15)",
                    color: rule.tier === "red" ? "var(--danger)" : "var(--warning)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {rule.tier}
                </span>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {rule.scope === "account" ? "All campaigns" : "Specific campaign"}
                </div>
              </div>
              <button
                onClick={() => onDelete(rule.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  padding: 4,
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

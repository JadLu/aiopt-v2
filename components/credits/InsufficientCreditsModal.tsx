"use client";

import { AlertCircle, Zap } from "lucide-react";
import { CREDIT_COSTS, videoCreditCost } from "@/lib/firebase/credits";

interface Props {
  open: boolean;
  onClose: () => void;
  required: number;
  balance: number;
}

const PRICING_ROWS: { label: string; cost: number }[] = [
  { label: "Marketing Plan", cost: CREDIT_COSTS.MARKETING_PLAN },
  { label: "Photo (image)", cost: CREDIT_COSTS.PHOTO },
  { label: "Landing Page", cost: CREDIT_COSTS.LANDING_PAGE },
  { label: "Video 5s / 6s", cost: videoCreditCost("5s") },
  { label: "Video 8s", cost: videoCreditCost("8s") },
  { label: "Video 10s", cost: videoCreditCost("10s") },
];

export function InsufficientCreditsModal({ open, onClose, required, balance }: Props) {
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-panel"
        style={{ maxWidth: 420, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--r-input)",
              background: "rgba(229,118,118,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertCircle size={18} style={{ color: "var(--danger)" }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Not enough credits
          </h2>
        </div>

        {/* Balance info */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "var(--r-input)",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-default)",
            marginBottom: 20,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          You have{" "}
          <span style={{ fontWeight: 700, color: "var(--danger)" }}>{balance} credits</span>
          {" "}— this action requires{" "}
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{required} credits</span>.
        </div>

        {/* Pricing table */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>
          Feature Pricing
        </p>
        <div
          style={{
            borderRadius: "var(--r-input)",
            border: "1px solid var(--border-default)",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          {PRICING_ROWS.map((row, i) => {
            const isHighlighted = row.cost === required;
            return (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: isHighlighted ? "rgba(90,200,214,0.08)" : i % 2 === 0 ? "var(--bg-elevated)" : "var(--bg-base)",
                  borderTop: i > 0 ? "1px solid var(--border-default)" : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: isHighlighted ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: isHighlighted ? 600 : 400,
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: isHighlighted ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  <Zap size={12} />
                  {row.cost}
                </span>
              </div>
            );
          })}
        </div>

        {/* Credit pack info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: "var(--r-input)",
            background: "rgba(90,200,214,0.06)",
            border: "1px solid rgba(90,200,214,0.2)",
            marginBottom: 16,
          }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Credit Pack
            </p>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
              Contact your admin to top up your balance.
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-primary)", margin: 0 }}>
              50 MAD
            </p>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
              1,000 credits
            </p>
          </div>
        </div>

        {/* Close */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ width: "auto", fontSize: 13 }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

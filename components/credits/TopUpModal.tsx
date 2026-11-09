"use client";

import { Zap } from "lucide-react";
import { PRICING_ROWS } from "./InsufficientCreditsModal";

interface Props {
  open: boolean;
  onClose: () => void;
  balance: number | null;
}

/** Pricing + credit-pack info, opened from the sidebar "Top up" link. */
export function TopUpModal({ open, onClose, balance }: Props) {
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-panel glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="topup-title"
        style={{ maxWidth: 420, width: "100%", borderRadius: "var(--r-dialog)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="topup-title" style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px", color: "var(--text-primary)" }}>
          Top up credits
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 18px" }}>
          Current balance: <strong className="tabular">{balance ?? "—"}</strong> credits
        </p>

        <div className="label-caps" style={{ marginBottom: 8 }}>Feature pricing</div>
        <div className="glass-inner" style={{ padding: "4px 14px", marginBottom: 16 }}>
          {PRICING_ROWS.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 0", borderTop: i > 0 ? "1px solid var(--hairline)" : undefined,
                fontSize: 13.5,
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span className="tabular" style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 600, color: "var(--accent-primary)" }}>
                <Zap size={12} aria-hidden />{row.cost}
              </span>
            </div>
          ))}
        </div>

        <div className="glass-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Credit pack</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Contact your admin to top up your balance.</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent-primary)" }}>50 MAD</div>
            <div className="tabular" style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>1,000 credits</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn-secondary" style={{ width: "auto" }} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

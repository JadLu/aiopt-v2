"use client";

import { useState } from "react";
import { Megaphone, ArrowRight, AlertCircle } from "lucide-react";

interface Props {
  onConnected: (token: string, expires: string, accounts: { id: string; name: string }[]) => void;
}

export function ConnectMetaBanner({ onConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/meta");
      const data = (await res.json()) as { url?: string; error?: string };
      if (!data.url) throw new Error(data.error ?? "Failed to get auth URL");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        gap: 24,
        textAlign: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "var(--radius-lg)",
          background: "rgba(90,200,214,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Megaphone size={32} style={{ color: "var(--accent-primary)" }} />
      </div>

      <div style={{ maxWidth: 420 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Connect your Meta Ads account
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
          Link your Meta Business account to monitor campaign performance,
          track ROAS and CPA, and get real-time alerts — all in one place.
        </p>
      </div>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            background: "rgba(229,118,118,0.1)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={loading}
        className="btn-primary"
        style={{ display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Redirecting…" : "Connect Meta Account"}
        {!loading && <ArrowRight size={15} />}
      </button>

      <p style={{ color: "var(--text-tertiary)", fontSize: 12, maxWidth: 360 }}>
        We request read and management permissions to display your campaign data.
        You can revoke access at any time from your Meta Business settings.
      </p>
    </div>
  );
}

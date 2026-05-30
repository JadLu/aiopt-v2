"use client";

import { useState } from "react";
import { X, Loader2, Image, Video, Link } from "lucide-react";
import { createCreative } from "@/lib/firebase/creatives";

interface AddCreativeDialogProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  projectId: string;
}

export function AddCreativeDialog({ open, onClose, uid, projectId }: AddCreativeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "photo" as "photo" | "video", url: "" });

  if (!open) return null;

  function handleClose() {
    setForm({ name: "", type: "photo", url: "" });
    setError(null);
    onClose();
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createCreative(uid, projectId, form);
      handleClose();
    } catch {
      setError("Failed to add creative. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="dialog-panel fade-up">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Add Creative</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>Link a photo or video to this project</p>
          </div>
          <button onClick={handleClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "flex", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Type toggle */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.04em" }}>TYPE</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["photo", "video"] as const).map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: "var(--radius-md)",
                    border: `1px solid ${form.type === t ? "var(--accent-primary)" : "var(--border-default)"}`,
                    background: form.type === t ? "rgba(90,200,214,0.10)" : "var(--bg-elevated)",
                    color: form.type === t ? "var(--accent-primary)" : "var(--text-secondary)",
                    fontSize: 13, fontWeight: form.type === t ? 600 : 400,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    fontFamily: "inherit", transition: "all 0.13s",
                  }}
                >
                  {t === "photo" ? <Image size={14} /> : <Video size={14} />}
                  {t === "photo" ? "Photo" : "Video"}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.04em" }}>NAME</label>
            <input
              type="text" required
              className="auth-input"
              placeholder={form.type === "photo" ? "e.g. Hero image — lifestyle shot" : "e.g. 15s UGC testimonial"}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* URL */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.04em" }}>
              <Link size={11} style={{ display: "inline", marginRight: 5 }} />
              {form.type === "photo" ? "IMAGE URL" : "VIDEO URL"}
            </label>
            <input
              type="url" required
              className="auth-input"
              placeholder={form.type === "photo" ? "https://..." : "https://..."}
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>

          {/* Photo preview */}
          {form.type === "photo" && form.url && (
            <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-default)", height: 140, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.url} alt="preview"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          {error && <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{error}</p>}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={handleClose} style={{ width: "auto", flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2 }}>
              {loading && <Loader2 size={15} className="spinner" />}
              Add Creative
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateProject } from "@/lib/firebase/projects";
import { useAuth } from "@/lib/contexts/auth-context";
import { authFetch } from "@/lib/auth-fetch";
import { deductCredits, refundCredits, CREDIT_COSTS } from "@/lib/firebase/credits";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import type { Project, PlanVisualData } from "@/lib/mock-data";

interface GeneratePlanDialogProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  project: Project;
}

type GenStatus = "generating" | "complete" | "error";

export function GeneratePlanDialog({ open, onClose, uid, project }: GeneratePlanDialogProps) {
  const router = useRouter();
  const { credits } = useAuth();
  const [status, setStatus] = useState<GenStatus>("generating");
  const [planText, setPlanText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!open) {
      setPlanText("");
      setStatus("generating");
      setErrorMsg("");
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    checkAndGenerate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [planText]);

  async function checkAndGenerate() {
    const result = await deductCredits(uid, CREDIT_COSTS.MARKETING_PLAN);
    if (!result.success) {
      setCreditModalOpen(true);
      setStatus("error");
      setErrorMsg("Insufficient credits.");
      return;
    }
    await generate();
  }

  async function generate() {
    try {
      const res = await authFetch("/api/marketing-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setPlanText(full);
      }

      function parseBlock(slug: string) {
        const re = new RegExp("```json:" + slug + "\\n([\\s\\S]*?)```");
        const m = full.match(re);
        if (!m) return null;
        try { return JSON.parse(m[1]); } catch { return null; }
      }
      const planVisualData: PlanVisualData = {
        market:   parseBlock("market-analysis"),
        channels: parseBlock("channels"),
        content:  parseBlock("content"),
        phases:   parseBlock("phases"),
        kpi:      parseBlock("kpi"),
        action:   parseBlock("action"),
      };
      // Remove undefined fields — Firestore doesn't support undefined values
      const cleanedData = Object.fromEntries(
        Object.entries(planVisualData).filter(([, v]) => v !== null)
      );
      await updateProject(uid, project.id, { marketingPlan: full, planVisualData: cleanedData, status: "active" });
      setStatus("complete");
    } catch (err) {
      await refundCredits(uid, CREDIT_COSTS.MARKETING_PLAN);
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  // Render InsufficientCreditsModal outside the open guard so it persists when open=false
  const insufficientModal = (
    <InsufficientCreditsModal
      open={creditModalOpen}
      onClose={() => { setCreditModalOpen(false); onClose(); }}
      required={CREDIT_COSTS.MARKETING_PLAN}
      balance={credits ?? 0}
    />
  );

  if (!open) return insufficientModal;

  const canClose = status !== "generating";

  return (
    <>
    <div
      className="dialog-overlay"
      onClick={canClose ? onClose : undefined}
      style={{ cursor: canClose ? "default" : "not-allowed" }}
    >
      <div
        className="dialog-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680, width: "calc(100vw - 48px)", display: "flex", flexDirection: "column", cursor: "default" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: status === "error"
                ? "rgba(239,68,68,0.15)"
                : "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {status === "error"
                ? <AlertCircle size={17} color="var(--danger)" />
                : status === "complete"
                  ? <CheckCircle2 size={17} color="#fff" />
                  : <Sparkles size={17} color="#fff" />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                {status === "generating" ? "Generating Marketing Plan" : status === "complete" ? "Plan Ready" : "Generation Failed"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                {project.emoji} {project.name} · {project.country}
              </div>
            </div>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4, borderRadius: 6, lineHeight: 0 }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content area */}
        {status === "error" ? (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
            background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 10,
          }}>
            <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>Generation failed</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>{errorMsg}</div>
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            style={{
              maxHeight: 360, minHeight: 120,
              overflowY: "auto",
              background: "var(--bg-subtle)",
              borderRadius: 10,
              padding: "14px 16px",
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              scrollbarWidth: "thin",
            }}
          >
            {planText ? (
              <>
                {planText}
                {status === "generating" && (
                  <span style={{ display: "inline-block", width: 2, height: 14, background: "var(--accent-primary)", marginLeft: 2, verticalAlign: "text-bottom", opacity: 0.9 }} />
                )}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)" }}>
                <Loader2 size={14} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {status === "generating" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "var(--text-tertiary)", fontSize: 12 }}>
            <Loader2 size={12} className="animate-spin" />
            Crafting your MENA marketing strategy — this takes about 30 seconds
          </div>
        )}

        {status === "complete" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--success)", fontSize: 13, fontWeight: 500 }}>
              <CheckCircle2 size={15} />
              Plan saved to your project
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-secondary"
                style={{ width: "auto", padding: "8px 18px", fontSize: 13 }}
                onClick={onClose}
              >
                Close
              </button>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "8px 18px", fontSize: 13 }}
                onClick={() => { onClose(); router.push(`/projects/${project.id}`); }}
              >
                <ExternalLink size={14} /> View full plan
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button
              className="btn-secondary"
              style={{ width: "auto", padding: "8px 18px", fontSize: 13 }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              style={{ width: "auto", padding: "8px 18px", fontSize: 13 }}
              onClick={() => { setStatus("generating"); setPlanText(""); setErrorMsg(""); started.current = false; generate(); }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
    {insufficientModal}
    </>
  );
}

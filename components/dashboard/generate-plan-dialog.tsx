"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { subscribeToProject } from "@/lib/firebase/projects";
import type { Unsubscribe } from "firebase/firestore";
import { useAuth } from "@/lib/contexts/auth-context";
import { startMarketingPlan } from "@/lib/marketing-plan-client";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";
import type { Project } from "@/lib/mock-data";

interface GeneratePlanDialogProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  project: Project;
}

type GenStatus = "generating" | "complete" | "error";

const PROGRESS_MESSAGES = [
  "Analyzing your target market...",
  "Mapping the channel mix...",
  "Shaping the creative strategy...",
  "Planning campaign phases...",
  "Setting KPI benchmarks...",
  "Drafting the 30-day action plan...",
];

export function GeneratePlanDialog({ open, onClose, uid, project }: GeneratePlanDialogProps) {
  const router = useRouter();
  const { credits } = useAuth();
  const [status, setStatus] = useState<GenStatus>("generating");
  const [errorMsg, setErrorMsg] = useState("");
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditInfo, setCreditInfo] = useState<{ required: number; balance: number }>({ required: CREDIT_COSTS.MARKETING_PLAN, balance: 0 });
  const [progressIdx, setProgressIdx] = useState(0);
  const started = useRef(false);
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus("generating");
      setErrorMsg("");
      setProgressIdx(0);
      started.current = false;
      unsubRef.current?.();
      unsubRef.current = null;
      return;
    }
    if (started.current) return;
    started.current = true;
    generate();
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (status !== "generating") return;
    const interval = setInterval(() => {
      setProgressIdx((i) => (i + 1) % PROGRESS_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [status]);

  async function generate() {
    try {
      const result = await startMarketingPlan(project);

      if (!result.ok && result.kind === "credits") {
        setCreditInfo({ required: result.required, balance: result.balance });
        setCreditModalOpen(true);
        setStatus("error");
        setErrorMsg("Insufficient credits.");
        return;
      }

      if (!result.ok) throw new Error(result.message);

      // Generation now runs server-side; watch the project doc for completion.
      unsubRef.current = subscribeToProject(uid, project.id, (p) => {
        if (!p) return;
        if (p.marketingPlanStatus === "failed") {
          setErrorMsg(p.marketingPlanError || "Something went wrong");
          setStatus("error");
          unsubRef.current?.();
          unsubRef.current = null;
        } else if (p.marketingPlanStatus === "done") {
          setStatus("complete");
          unsubRef.current?.();
          unsubRef.current = null;
        }
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  // Render InsufficientCreditsModal outside the open guard so it persists when open=false
  const insufficientModal = (
    <InsufficientCreditsModal
      open={creditModalOpen}
      onClose={() => { setCreditModalOpen(false); onClose(); }}
      required={creditInfo.required}
      balance={credits ?? creditInfo.balance}
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
                  ? <CheckCircle2 size={17} color="var(--on-accent)" />
                  : <Sparkles size={17} color="var(--on-accent)" />}
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
        ) : status === "complete" ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            padding: "36px 16px", background: "var(--bg-subtle)", borderRadius: 10,
          }}>
            <CheckCircle2 size={28} color="var(--success)" />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
              Your MENA marketing strategy is ready.
            </div>
          </div>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
            minHeight: 160,
            background: "var(--bg-subtle)",
            borderRadius: 10,
            padding: "24px 16px",
          }}>
            <Loader2 size={22} className="animate-spin" color="var(--accent-primary)" />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
              {PROGRESS_MESSAGES[progressIdx]}
            </div>
          </div>
        )}

        {/* Footer */}
        {status === "generating" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "var(--text-tertiary)", fontSize: 12 }}>
            <Loader2 size={12} className="animate-spin" />
            Crafting your MENA marketing strategy — this can take a few minutes
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
              onClick={() => { setStatus("generating"); setErrorMsg(""); started.current = false; generate(); }}
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

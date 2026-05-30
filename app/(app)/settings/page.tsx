"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { updateProfile, deleteUser } from "firebase/auth";
import {
  User, Palette, Shield, Bell, LogOut, Trash2,
  CheckCircle2, AlertCircle, Sun, Moon, Monitor,
  Pencil, Check, X, Mail, Calendar, Lock,
} from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { signOut, resetPassword, getFirebaseAuth } from "@/lib/firebase/auth";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, color, title }: { icon: React.ElementType; color: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border-default)" }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${color} 14%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={color} strokeWidth={1.8} />
      </div>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h2>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 42, height: 24, borderRadius: 12, cursor: "pointer", position: "relative", flexShrink: 0,
        background: on ? "var(--accent-primary)" : "var(--bg-subtle)",
        border: `1px solid ${on ? "var(--accent-primary)" : "var(--border-strong)"}`,
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: on ? "calc(100% - 22px)" : 2,
        width: 18, height: 18, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        transition: "left 0.2s",
      }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const THEMES = [
  { key: "light",  label: "Light",  Icon: Sun },
  { key: "dark",   label: "Dark",   Icon: Moon },
  { key: "system", label: "System", Icon: Monitor },
] as const;

const NOTIF_ROWS = [
  { key: "perf"   as const, title: "Performance Alerts",       desc: "Get notified when CPA or ROAS cross your targets" },
  { key: "weekly" as const, title: "Weekly Digest",            desc: "Summary of all project performance every Monday" },
  { key: "phase"  as const, title: "Campaign Phase Updates",   desc: "Alerts when a campaign moves to the next phase" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const { theme, setTheme } = useTheme();

  // Profile edit
  const [editingName, setEditingName] = useState(false);
  const [nameValue,   setNameValue]   = useState("");
  const [nameSaving,  setNameSaving]  = useState(false);

  // Security
  const [resetSent,    setResetSent]    = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Notifications
  const [notifs, setNotifs] = useState({ perf: true, weekly: false, phase: true });

  // Sign out
  const [signingOut, setSigningOut] = useState(false);

  // Delete account
  const [deleteOpen,    setDeleteOpen]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting,      setDeleting]      = useState(false);

  // Feedback toast
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (user) setNameValue(user.displayName ?? "");
  }, [user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("aiopt_notif");
      if (raw) setNotifs(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function flash(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  }

  function toggleNotif(key: keyof typeof notifs) {
    setNotifs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("aiopt_notif", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  async function handleSaveName() {
    if (!user || !nameValue.trim()) return;
    setNameSaving(true);
    try {
      await updateProfile(user, { displayName: nameValue.trim() });
      setEditingName(false);
      flash("success", "Display name updated.");
    } catch {
      flash("error", "Failed to update name.");
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    setResetLoading(true);
    try {
      await resetPassword(user.email);
      setResetSent(true);
      flash("success", `Reset link sent to ${user.email}`);
    } catch {
      flash("error", "Failed to send reset email.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.push("/login");
    } catch {
      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteUser(user);
      router.push("/login");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/requires-recent-login") {
        flash("error", "Please sign out and sign back in, then try again.");
      } else {
        flash("error", "Could not delete account. Please try again.");
      }
      setDeleting(false);
      setDeleteOpen(false);
      setDeleteConfirm("");
    }
  }

  if (!user) return null;

  const initials = (user.displayName ?? user.email ?? "?")
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isGoogle   = user.providerData.some(p => p.providerId === "google.com");
  const isPassword = user.providerData.some(p => p.providerId === "password");

  const memberSince = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <>
      <header className="app-topbar">
        <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Settings</h1>
      </header>

      <div className="app-content fade-up" style={{ maxWidth: 680 }}>

        {/* Feedback toast */}
        {feedback && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
            padding: "11px 16px", borderRadius: 10,
            background: feedback.type === "success"
              ? "color-mix(in srgb, var(--success) 10%, transparent)"
              : "color-mix(in srgb, var(--danger) 10%, transparent)",
            border: `1px solid ${feedback.type === "success"
              ? "color-mix(in srgb, var(--success) 30%, transparent)"
              : "color-mix(in srgb, var(--danger) 30%, transparent)"}`,
          }}>
            {feedback.type === "success"
              ? <CheckCircle2 size={15} color="var(--success)" />
              : <AlertCircle  size={15} color="var(--danger)" />
            }
            <span style={{ fontSize: 13, color: feedback.type === "success" ? "var(--success)" : "var(--danger)" }}>
              {feedback.msg}
            </span>
          </div>
        )}

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 14 }}>
          <SectionHead icon={User} color="var(--accent-primary)" title="Profile" />

          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            {/* Avatar */}
            <div style={{
              width: 60, height: 60, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
            }}>
              {user.photoURL
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={user.photoURL} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{initials}</span>
              }
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Display name */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                  Display Name
                </div>
                {editingName ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="auth-input"
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") { setEditingName(false); setNameValue(user.displayName ?? ""); }
                      }}
                      style={{ flex: 1, height: 36, padding: "0 12px", fontSize: 13 }}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={nameSaving || !nameValue.trim()}
                      style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: "var(--accent-primary)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: (nameSaving || !nameValue.trim()) ? 0.5 : 1 }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameValue(user.displayName ?? ""); }}
                      style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border-default)", background: "var(--bg-subtle)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {user.displayName || <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Not set</span>}
                    </span>
                    <button
                      onClick={() => setEditingName(true)}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid var(--border-default)", borderRadius: 7, padding: "3px 8px", fontSize: 11, color: "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <Pencil size={10} /> Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Meta row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Email</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                    <Mail size={12} strokeWidth={1.8} />
                    {user.email}
                    {user.emailVerified && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--success)", background: "color-mix(in srgb, var(--success) 12%, transparent)", padding: "1px 7px", borderRadius: 99 }}>
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                {memberSince && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Member Since</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                      <Calendar size={12} strokeWidth={1.8} /> {memberSince}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Sign-in Method</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {isGoogle && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-secondary)", background: "color-mix(in srgb, var(--accent-secondary) 10%, transparent)", padding: "2px 9px", borderRadius: 99 }}>
                        Google
                      </span>
                    )}
                    {isPassword && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "var(--bg-subtle)", border: "1px solid var(--border-default)", padding: "2px 9px", borderRadius: 99 }}>
                        Password
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 14 }}>
          <SectionHead icon={Palette} color="#C084FC" title="Appearance" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {THEMES.map(({ key, label, Icon }) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                    borderRadius: 10, cursor: "pointer", fontSize: 13, fontFamily: "inherit", transition: "all 0.13s",
                    border: `1px solid ${active ? "#C084FC" : "var(--border-default)"}`,
                    background: active ? "color-mix(in srgb, #C084FC 10%, transparent)" : "var(--bg-subtle)",
                    color: active ? "#C084FC" : "var(--text-secondary)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Icon size={14} strokeWidth={1.8} /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Security ────────────────────────────────────────────────────── */}
        {isPassword && (
          <div className="card" style={{ padding: "20px 24px", marginBottom: 14 }}>
            <SectionHead icon={Shield} color="var(--accent-secondary)" title="Security" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>Change Password</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Send a reset link to {user.email}</div>
              </div>
              <button
                onClick={handlePasswordReset}
                disabled={resetLoading || resetSent}
                style={{
                  display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                  padding: "9px 16px", borderRadius: 9, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                  border: `1px solid ${resetSent ? "var(--success)" : "var(--border-default)"}`,
                  background: resetSent ? "color-mix(in srgb, var(--success) 10%, transparent)" : "var(--bg-subtle)",
                  color: resetSent ? "var(--success)" : "var(--text-secondary)",
                  opacity: resetLoading ? 0.6 : 1, transition: "all 0.13s",
                }}
              >
                {resetSent
                  ? <><CheckCircle2 size={13} /> Sent!</>
                  : <><Lock size={13} /> Send Reset Email</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 14 }}>
          <SectionHead icon={Bell} color="var(--warning)" title="Notifications" />
          {NOTIF_ROWS.map(({ key, title, desc }, i) => (
            <div
              key={key}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                padding: "14px 0",
                borderBottom: i < NOTIF_ROWS.length - 1 ? "1px solid var(--border-default)" : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{desc}</div>
              </div>
              <Toggle on={notifs[key]} onChange={() => toggleNotif(key)} />
            </div>
          ))}
        </div>

        {/* ── Sign Out ────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: "20px 24px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>Sign Out</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Sign out of your account on this device</div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                padding: "10px 20px", borderRadius: 10, fontSize: 13, fontFamily: "inherit", fontWeight: 600,
                border: "1px solid color-mix(in srgb, var(--danger) 35%, var(--border-default))",
                background: "color-mix(in srgb, var(--danger) 7%, transparent)",
                color: "var(--danger)", cursor: "pointer", transition: "all 0.13s",
                opacity: signingOut ? 0.6 : 1,
              }}
            >
              <LogOut size={14} strokeWidth={1.8} />
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </div>

        {/* ── Danger Zone ─────────────────────────────────────────────────── */}
        <div
          className="card"
          style={{ padding: "20px 24px", marginBottom: 32, border: "1px solid color-mix(in srgb, var(--danger) 22%, var(--border-default))" }}
        >
          <SectionHead icon={Trash2} color="var(--danger)" title="Danger Zone" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>Delete Account</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Permanently remove your account and all project data. Cannot be undone.
              </div>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                padding: "9px 16px", borderRadius: 10, fontSize: 13, fontFamily: "inherit", fontWeight: 600,
                border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                color: "var(--danger)", cursor: "pointer",
              }}
            >
              <Trash2 size={13} /> Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteOpen && (
        <div className="dialog-overlay" onClick={() => !deleting && (setDeleteOpen(false), setDeleteConfirm(""))}>
          <div className="dialog-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "color-mix(in srgb, var(--danger) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Trash2 size={18} color="var(--danger)" />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Delete Account</h2>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>This action is permanent and irreversible.</p>
              </div>
            </div>

            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 16px" }}>
              All your projects, marketing plans, and generated creatives will be permanently deleted.
              Type <strong style={{ color: "var(--danger)" }}>DELETE</strong> to confirm.
            </p>

            <input
              className="auth-input"
              placeholder="Type DELETE to confirm"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              style={{ marginBottom: 20, fontSize: 13 }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-secondary"
                disabled={deleting}
                onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== "DELETE"}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  background: deleteConfirm === "DELETE" && !deleting ? "var(--danger)" : "var(--bg-subtle)",
                  color: deleteConfirm === "DELETE" && !deleting ? "#fff" : "var(--text-tertiary)",
                  fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                  cursor: (deleting || deleteConfirm !== "DELETE") ? "not-allowed" : "pointer",
                  opacity: deleting ? 0.6 : 1, transition: "all 0.15s",
                }}
              >
                <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

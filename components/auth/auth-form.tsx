"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { signIn, signUp, signInWithGoogle, resetPassword, mapFirebaseError } from "@/lib/firebase/auth";

type Mode = "login" | "signup" | "reset";

function getPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"] as const;
const strengthClass = ["", "weak", "fair", "good", "strong"] as const;

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UX state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const strength = mode === "signup" ? getPasswordStrength(password) : 0;

  const clearMessages = useCallback(() => {
    setError("");
    setSuccessMsg("");
  }, []);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    clearMessages();
    setPassword("");
    setConfirmPassword("");
  }, [clearMessages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (strength < 2) {
        setError("Please choose a stronger password.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        router.push("/dashboard");
      } else if (mode === "signup") {
        await signUp(email, password, name.trim() || email.split("@")[0]);
        router.push("/dashboard");
      } else {
        await resetPassword(email);
        setSuccessMsg("Password reset email sent! Check your inbox.");
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(mapFirebaseError(code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    clearMessages();
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(mapFirebaseError(code));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="glass-card fade-up" style={{ borderRadius: "var(--radius-lg)", padding: "36px", width: "100%", maxWidth: "440px" }}>
      {/* Logo / Brand */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, #5AC8D6 0%, #6FB1E8 100%)",
            marginBottom: 14,
            boxShadow: "0 4px 16px rgba(90,200,214,0.35)",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>AIOPT</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, marginBottom: 0 }}>
          {mode === "reset" ? "Reset your password" : "All-in-One E-commerce Tool"}
        </p>
      </div>

      {/* Tab switcher — only for login/signup */}
      {mode !== "reset" && (
        <div className="auth-tabs" style={{ marginBottom: "24px" }}>
          <button
            type="button"
            className={`auth-tab${mode === "login" ? " active" : ""}`}
            onClick={() => switchMode("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab${mode === "signup" ? " active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Create Account
          </button>
        </div>
      )}

      {/* Error / Success messages */}
      {error && (
        <div className="msg-error fade-up" style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="msg-success fade-up" style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Name — signup only */}
        {mode === "signup" && (
          <div className="fade-up">
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.02em" }}>
              FULL NAME
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                className="auth-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                style={{ paddingLeft: 42 }}
              />
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", display: "flex" }}>
                <User size={15} />
              </span>
            </div>
          </div>
        )}

        {/* Email */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.02em" }}>
            EMAIL
          </label>
          <div className="input-wrapper">
            <input
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ paddingLeft: 42 }}
            />
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", display: "flex" }}>
              <Mail size={15} />
            </span>
          </div>
        </div>

        {/* Password — not shown on reset */}
        {mode !== "reset" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
                PASSWORD
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  style={{ fontSize: 12, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="auth-input"
                placeholder={mode === "signup" ? "Min 8 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                style={{ paddingLeft: 42 }}
              />
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", display: "flex" }}>
                <Lock size={15} />
              </span>
              <button type="button" className="input-icon-btn" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Password strength — signup only */}
            {mode === "signup" && password.length > 0 && (
              <div className="fade-up" style={{ marginTop: 8 }}>
                <div className="strength-bars">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`strength-bar${strength >= i ? ` ${strengthClass[strength]}` : ""}`}
                    />
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 5 }}>
                  {strengthLabel[strength]} password
                </p>
              </div>
            )}
          </div>
        )}

        {/* Confirm password — signup only */}
        {mode === "signup" && (
          <div className="fade-up">
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.02em" }}>
              CONFIRM PASSWORD
            </label>
            <div className="input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                className={`auth-input${confirmPassword && confirmPassword !== password ? " error" : ""}`}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ paddingLeft: 42 }}
              />
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", display: "flex" }}>
                <Lock size={15} />
              </span>
              <button type="button" className="input-icon-btn" onClick={() => setShowConfirmPassword((v) => !v)}>
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="fade-up" style={{ fontSize: 11, color: "var(--danger)", marginTop: 5 }}>Passwords don&apos;t match</p>
            )}
          </div>
        )}

        {/* Submit */}
        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? (
            <Loader2 size={16} className="spinner" />
          ) : null}
          {mode === "login" && "Sign In"}
          {mode === "signup" && "Create Account"}
          {mode === "reset" && "Send Reset Link"}
        </button>

        {/* Back link for reset mode */}
        {mode === "reset" && (
          <button
            type="button"
            onClick={() => switchMode("login")}
            style={{ fontSize: 13, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", textAlign: "center", fontFamily: "inherit" }}
          >
            ← Back to Sign In
          </button>
        )}
      </form>

      {/* OAuth divider + Google — not on reset */}
      {mode !== "reset" && (
        <>
          <div className="or-divider" style={{ margin: "20px 0" }}>or</div>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 size={15} className="spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>
        </>
      )}

      {/* Terms — signup */}
      {mode === "signup" && (
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          By creating an account you agree to our{" "}
          <a href="/terms" style={{ color: "var(--accent-primary)", textDecoration: "none" }}>Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" style={{ color: "var(--accent-primary)", textDecoration: "none" }}>Privacy Policy</a>.
        </p>
      )}
    </div>
  );
}

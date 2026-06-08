import { AuthForm } from "@/components/auth/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Sign In — AIOPT",
};

export default function LoginPage() {
  return (
    <main
      className="auth-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient blobs — same layer as app pages */}
      <div className="ambient"><span className="b3" /></div>

      {/* Dark mode toggle — top right */}
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 2 }}>
        <ThemeToggle />
      </div>

      {/* Auth card */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <AuthForm />

        {/* Footer */}
        <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
          © {new Date().getFullYear()} AIOPT · Built for MENA E-commerce
        </p>
      </div>
    </main>
  );
}

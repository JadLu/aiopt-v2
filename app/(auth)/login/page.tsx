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
      }}
    >
      {/* Dark mode toggle — top right */}
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <ThemeToggle />
      </div>

      {/* Auth card */}
      <AuthForm />

      {/* Footer */}
      <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
        © {new Date().getFullYear()} AIOPT · Built for MENA E-commerce
      </p>
    </main>
  );
}

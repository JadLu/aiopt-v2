import { Sidebar } from "@/components/sidebar";
import { AuthProvider } from "@/lib/contexts/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="ambient"><div className="b3" /></div>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">{children}</div>
      </div>
    </AuthProvider>
  );
}

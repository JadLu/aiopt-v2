import { ProfileWidget } from "@/components/profile-widget";
import { AuthProvider } from "@/lib/contexts/auth-context";
import { NotificationsProvider } from "@/lib/contexts/notifications-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>
      <div className="ambient" aria-hidden>
        <div className="b3" />
        <div className="b4" />
      </div>
      <div className="app-shell">
        <main className="app-main">{children}</main>
      </div>
      <ProfileWidget />
      </NotificationsProvider>
    </AuthProvider>
  );
}

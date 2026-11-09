"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Settings } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { TopUpModal } from "@/components/credits/TopUpModal";

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (email) return email[0].toUpperCase();
  return "U";
}

function getFirstName(name: string | null | undefined, email: string | null | undefined): string {
  if (name) return name.split(" ")[0];
  if (email) return email.split("@")[0];
  return "User";
}

/**
 * Rounded profile + credits widget, fixed at the bottom left.
 * The whole widget opens Settings; the Top up button opens the top-up dialog instead.
 */
export function ProfileWidget() {
  const pathname = usePathname();
  const { user, credits, creditsLoading } = useAuth();
  const [topUpOpen, setTopUpOpen] = useState(false);

  const initials = getInitials(user?.displayName, user?.email);
  const firstName = getFirstName(user?.displayName, user?.email);
  const creditsKnown = !creditsLoading && credits !== null;
  const creditColor =
    credits !== null && credits < 10 ? "var(--danger)"
    : credits !== null && credits < 50 ? "var(--warning)"
    : "var(--accent-primary)";

  return (
    <>
      <div className="glass profile-widget lift">
        {/* The link's ::after stretches over the whole widget, so any click lands on Settings. */}
        <Link
          href="/settings"
          className="profile-widget-main"
          aria-label={`${firstName}, account settings`}
          aria-current={pathname === "/settings" ? "page" : undefined}
        >
          <span className="user-avatar" aria-hidden>{initials}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="user-name" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName}</span>
            <span className="user-plan" style={{ display: "block", color: "var(--text-secondary)" }}>Pro · workspace</span>
          </span>
          <Settings size={16} strokeWidth={1.8} style={{ flex: "none", color: "var(--text-secondary)" }} aria-hidden />
        </Link>

        <div className="profile-widget-foot">
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: creditsKnown ? creditColor : "var(--text-secondary)" }}>
            <Zap size={14} fill="currentColor" aria-hidden />
            <span className="tabular">{creditsKnown ? `${credits.toLocaleString()} credits` : "… credits"}</span>
          </span>
          <button type="button" className="sidebar-link profile-widget-topup" onClick={() => setTopUpOpen(true)}>
            Top up
          </button>
        </div>
      </div>

      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} balance={credits} />
    </>
  );
}

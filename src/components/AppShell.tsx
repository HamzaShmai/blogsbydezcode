import Link from "next/link";
import { ReactNode } from "react";
import { SidebarNav } from "@/components/SidebarNav";

const agencyLinks = [
  { href: "/agency", label: "Home" },
  { href: "/agency/websites", label: "1. Websites" },
  { href: "/agency/articles", label: "2. Articles" },
  { href: "/agency/backlinks", label: "4. Backlinks" },
  { href: "/agency/calendar", label: "Calendar" },
  { href: "/agency/jobs", label: "Jobs" },
  { href: "/agency/connect", label: "Connect site" },
  { href: "/agency/settings", label: "Settings" },
];

const clientLinks = [
  { href: "/client", label: "Home" },
  { href: "/client/websites", label: "My websites" },
  { href: "/client/articles", label: "Articles" },
  { href: "/client/calendar", label: "Calendar" },
  { href: "/client/reports", label: "Reports" },
];

export function AppShell({
  portal,
  title,
  userEmail,
  children,
}: {
  portal: "agency" | "client";
  title: string;
  userEmail?: string | null;
  children: ReactNode;
}) {
  const links = portal === "agency" ? agencyLinks : clientLinks;
  const initial = (userEmail || "?").slice(0, 1).toUpperCase();

  return (
    <div className="shell">
      <div className="shell-glow" aria-hidden />
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">PulseRank</span>
          <span className="brand-sub">
            {portal === "agency" ? "Agency desk" : "Client desk"}
          </span>
        </div>
        <SidebarNav links={links} />
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="user-avatar" aria-hidden>
              {initial}
            </span>
            <div>
              <div className="user-mail">{userEmail}</div>
              <Link href="/api/auth/signout" className="signout-link">
                Sign out
              </Link>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        {title ? (
          <header className="page-header">
            <h1>{title}</h1>
          </header>
        ) : null}
        {children}
      </main>
    </div>
  );
}

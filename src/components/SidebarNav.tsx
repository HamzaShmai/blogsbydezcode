"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="side-nav">
      {links.map((l) => {
        const active =
          l.href === "/agency" || l.href === "/client"
            ? pathname === l.href
            : pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={active ? "nav-link is-active" : "nav-link"}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const isAgency = session.user.memberships.some(
    (m) => m.role === "AGENCY_ADMIN" || m.role === "AGENCY_MEMBER"
  );
  if (!isAgency) {
    return <div className="main">Client accounts should use the client portal.</div>;
  }

  return (
    <AppShell portal="agency" title="" userEmail={session.user.email}>
      {children}
    </AppShell>
  );
}

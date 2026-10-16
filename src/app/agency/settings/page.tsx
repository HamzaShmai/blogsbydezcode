import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isEmergencyStopped } from "@/lib/emergency";
import { EmergencyStopControl } from "@/components/EmergencyStopControl";
import { InviteForm } from "@/components/InviteForm";
import { CreateOrgForm } from "@/components/CreateOrgForm";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await requireUser();
  const isAgencyAdmin = session.user.memberships.some((m) => m.role === "AGENCY_ADMIN");
  if (!isAgencyAdmin) redirect("/agency");

  const emergency = await isEmergencyStopped();
  const orgs = await prisma.organization.findMany({
    where: {
      memberships: {
        some: {
          userId: session.user.id,
          role: { in: ["AGENCY_ADMIN", "CLIENT_ADMIN"] },
        },
      },
    },
    select: { id: true, name: true, type: true },
  });
  const agencyId = orgs.find((o) => o.type === "AGENCY")?.id;
  const orgIds = orgs.map((o) => o.id);

  // Only audit events for orgs this admin belongs to — never global dump
  const audits = await prisma.auditLog.findMany({
    where: {
      OR: [
        { organizationId: { in: orgIds } },
        { userId: session.user.id },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      // metaJson may contain emails — keep but never secrets (writers must not log secrets)
      metaJson: true,
    },
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Settings & safety</h1>
          <p className="muted">Emergency stop, invites, and scoped audit trail.</p>
        </div>
      </header>

      <EmergencyStopControl active={emergency} />
      <CreateOrgForm agencyId={agencyId} />
      <InviteForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />

      <section className="panel">
        <h2>Recent audit log</h2>
        {audits.map((a) => (
          <div key={a.id} className="list-item">
            <span>{a.action}</span>
            <span className="muted">
              {a.entityType} {a.entityId?.slice(0, 8)} ·{" "}
              {a.createdAt.toISOString().slice(0, 19)}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

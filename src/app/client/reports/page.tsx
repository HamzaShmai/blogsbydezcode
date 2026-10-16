import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { DataTable } from "@/components/DataTable";

export default async function ClientReportsPage() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);
  const reports = await prisma.monthlyReport.findMany({
    where: { websiteId: { in: ids } },
    include: { website: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Monthly reports</h1>
          <p className="muted">Measured snapshots with estimates clearly labeled in payloads.</p>
        </div>
      </header>
      <section className="panel">
        <DataTable
          headers={["Website", "Period", "Kind", "Created"]}
          rows={reports.map((r) => [
            r.website.name,
            `${r.year}-${String(r.month).padStart(2, "0")}`,
            r.kind,
            r.createdAt.toISOString().slice(0, 10),
          ])}
        />
        {!reports.length ? (
          <p className="muted">No reports yet. Agency can enqueue MONTHLY_REPORT jobs.</p>
        ) : null}
      </section>
    </>
  );
}

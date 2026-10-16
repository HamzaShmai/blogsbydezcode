import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { DataTable } from "@/components/DataTable";
import { RetryJobButton } from "@/components/RetryJobButton";

export default async function JobsPage() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);
  const jobs = await prisma.job.findMany({
    where: { websiteId: { in: ids } },
    include: {
      website: { select: { name: true } },
      logs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Jobs</h1>
          <p className="muted">Cloud queue execution logs, retries, and failures.</p>
        </div>
      </header>
      <section className="panel">
        <DataTable
          headers={["Type", "Website", "Status", "Attempts", "Error", ""]}
          rows={jobs.map((j) => [
            j.type,
            j.website?.name ?? "—",
            j.status,
            String(j.attempts),
            j.lastError?.slice(0, 80) ?? j.logs[0]?.message ?? "—",
            j.status === "FAILED" && j.websiteId ? (
              <RetryJobButton
                key={j.id}
                websiteId={j.websiteId}
                type={j.type}
              />
            ) : (
              "—"
            ),
          ])}
        />
      </section>
    </>
  );
}

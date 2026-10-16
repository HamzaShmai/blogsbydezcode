import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { DataTable } from "@/components/DataTable";

export default async function ClientCalendarPage() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);
  const events = await prisma.article.findMany({
    where: {
      websiteId: { in: ids },
      status: { in: ["SCHEDULED", "PENDING_APPROVAL", "PUBLISHED"] },
    },
    include: { website: true },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <>
      <header className="page-header">
        <h1>Publication calendar</h1>
      </header>
      <section className="panel">
        <DataTable
          headers={["When", "Title", "Website", "Status"]}
          rows={events.map((e) => [
            (e.scheduledAt || e.publishedAt)?.toISOString().slice(0, 16) ?? "—",
            e.title,
            e.website.name,
            e.status,
          ])}
        />
      </section>
    </>
  );
}

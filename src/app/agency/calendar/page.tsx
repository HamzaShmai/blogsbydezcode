import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

export default async function CalendarPage() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);
  const events = await prisma.article.findMany({
    where: {
      websiteId: { in: ids },
      status: { in: ["SCHEDULED", "PENDING_APPROVAL", "PUBLISHED", "FAILED"] },
    },
    include: { website: true },
    orderBy: [{ scheduledAt: "asc" }, { publishedAt: "desc" }],
    take: 100,
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Publishing calendar</h1>
          <p className="muted">Scheduled, pending, published and failed posts.</p>
        </div>
      </header>
      <section className="panel">
        <DataTable
          headers={["When", "Title", "Website", "Status", ""]}
          rows={events.map((e) => [
            (e.scheduledAt || e.publishedAt)?.toISOString().slice(0, 16) ?? "—",
            e.title,
            e.website.name,
            e.status,
            <Link key={e.id} href={`/agency/articles/${e.id}`}>
              Open
            </Link>,
          ])}
        />
      </section>
    </>
  );
}

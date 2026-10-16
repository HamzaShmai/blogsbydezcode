import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { DataTable } from "@/components/DataTable";

export default async function ArticlesPage() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);
  const articles = await prisma.article.findMany({
    where: { websiteId: { in: ids } },
    include: { website: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Articles</h1>
          <p className="muted">Drafts, approvals, scheduled and published posts.</p>
        </div>
      </header>
      <section className="panel">
        <DataTable
          headers={["Title", "Website", "Status", "Quality", "Updated", ""]}
          rows={articles.map((a) => [
            a.title,
            a.website.name,
            a.status,
            a.qualityScore?.toFixed(2) ?? "—",
            a.updatedAt.toISOString().slice(0, 10),
            <Link key={a.id} href={`/agency/articles/${a.id}`}>
              Open
            </Link>,
          ])}
        />
      </section>
    </>
  );
}

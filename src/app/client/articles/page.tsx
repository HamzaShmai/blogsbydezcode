import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { DataTable } from "@/components/DataTable";

export default async function ClientArticlesPage() {
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
        <h1>Articles</h1>
      </header>
      <section className="panel">
        <DataTable
          headers={["Title", "Website", "Status", "Published URL"]}
          rows={articles.map((a) => [
            <Link key={a.id} href={`/client/articles/${a.id}`}>
              {a.title}
            </Link>,
            a.website.name,
            a.status,
            a.publishedUrl ?? "—",
          ])}
        />
      </section>
    </>
  );
}

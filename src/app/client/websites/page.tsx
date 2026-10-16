import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { DataTable } from "@/components/DataTable";

export default async function ClientWebsitesPage() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);
  const websites = await prisma.website.findMany({
    where: { id: { in: ids } },
    include: { settings: true, _count: { select: { articles: true } } },
  });

  return (
    <>
      <header className="page-header">
        <h1>Websites</h1>
      </header>
      <section className="panel">
        <DataTable
          headers={["Name", "Domain", "Mode", "Articles", ""]}
          rows={websites.map((w) => [
            w.name,
            w.domain,
            w.settings?.publishMode ?? "—",
            String(w._count.articles),
            <Link key={w.id} href={`/client/websites/${w.id}`}>
              Open
            </Link>,
          ])}
        />
      </section>
    </>
  );
}

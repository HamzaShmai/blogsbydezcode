import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { DataTable } from "@/components/DataTable";
import { CreateWebsiteForm } from "@/components/CreateWebsiteForm";
import { QuickAuditForm } from "@/components/QuickAuditForm";

export default async function WebsitesPage() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);
  const websites = await prisma.website.findMany({
    where: { id: { in: ids } },
    include: {
      settings: true,
      organization: true,
      _count: { select: { articles: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        {
          memberships: {
            some: {
              userId: session.user.id,
              role: { in: ["AGENCY_ADMIN", "AGENCY_MEMBER"] },
            },
          },
        },
        { agency: { memberships: { some: { userId: session.user.id } } } },
      ],
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h1>Websites</h1>
          <p className="lede">
            Add a domain (CMS optional). Then open a site → Analyze → Generate blog.
            Credentials stay encrypted.
          </p>
        </div>
      </header>

      <div className="disclaimer">
        <strong>Easy path:</strong> Quick free audit below (no CMS) → or create a
        full website → open it → run the 3 buttons: Analyze, Keywords, Write blog.
      </div>

      <QuickAuditForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />

      <div style={{ marginTop: "1.25rem" }}>
        <CreateWebsiteForm organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
      </div>

      <section className="panel panel-rich" style={{ marginTop: "1rem" }}>
        <h2>Connected</h2>
        <DataTable
          headers={["Name", "Domain", "CMS", "Mode", "Articles", ""]}
          rows={websites.map((w) => [
            w.name,
            w.domain,
            w.cmsType.replaceAll("_", " "),
            w.settings?.publishMode?.replaceAll("_", " ") ?? "—",
            String(w._count.articles),
            <Link key={w.id} href={`/agency/websites/${w.id}`}>
              Open desk →
            </Link>,
          ])}
        />
      </section>
    </>
  );
}

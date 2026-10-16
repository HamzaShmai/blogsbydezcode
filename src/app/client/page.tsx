import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { StatGrid } from "@/components/StatGrid";
import Link from "next/link";

export default async function ClientHome() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);
  const [websites, published, pending, issues] = await Promise.all([
    prisma.website.findMany({
      where: { id: { in: ids } },
      include: { settings: true },
    }),
    prisma.article.count({ where: { websiteId: { in: ids }, status: "PUBLISHED" } }),
    prisma.article.count({
      where: { websiteId: { in: ids }, status: "PENDING_APPROVAL" },
    }),
    prisma.seoIssue.count({
      where: { resolved: false, audit: { websiteId: { in: ids } } },
    }),
  ]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Your desk</p>
          <h1>Welcome</h1>
          <p className="lede">
            Open a website to see SEO health, approve articles, and track what
            was published for you.
          </p>
        </div>
      </header>

      <section className="howto-grid" aria-label="Quick guide">
        <Link href="/client/websites" className="howto-card">
          <span className="howto-num">1</span>
          <strong>Pick a site</strong>
          <span>See SEO score, keyword ideas, and recent audits.</span>
          <span className="btn secondary">My websites</span>
        </Link>
        <Link href="/client/articles" className="howto-card">
          <span className="howto-num">2</span>
          <strong>Review blogs</strong>
          <span>Approve drafts or check published posts.</span>
          <span className="btn secondary">Articles</span>
        </Link>
        <Link href="/client/reports" className="howto-card">
          <span className="howto-num">3</span>
          <strong>Read reports</strong>
          <span>Simple progress — clicks, content, open issues.</span>
          <span className="btn secondary">Reports</span>
        </Link>
      </section>

      <StatGrid
        items={[
          { label: "Websites", value: websites.length, kind: "measured" },
          { label: "Published", value: published, kind: "measured" },
          { label: "Pending approval", value: pending, kind: "measured" },
          { label: "Open SEO issues", value: issues, kind: "measured" },
        ]}
      />
      <section className="panel panel-rich">
        <h2>Your websites</h2>
        {websites.map((w) => (
          <Link key={w.id} href={`/client/websites/${w.id}`} className="site-row">
            <div>
              <strong>{w.name}</strong>
              <span className="muted">{w.domain}</span>
            </div>
            <span className="pill">Open</span>
          </Link>
        ))}
        {!websites.length ? (
          <p className="muted">No websites assigned yet. Ask your agency to add you.</p>
        ) : null}
      </section>
    </>
  );
}

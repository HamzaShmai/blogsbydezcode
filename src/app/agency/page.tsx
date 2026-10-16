import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { StatGrid } from "@/components/StatGrid";
import { isEmergencyStopped } from "@/lib/emergency";

export default async function AgencyHome() {
  const session = await requireUser();
  const websiteIds = await getAccessibleWebsiteIds(session.user.id);
  const [websites, articles, failedJobs, orgs, emergency, recentSites] =
    await Promise.all([
      prisma.website.count({ where: { id: { in: websiteIds } } }),
      prisma.article.groupBy({
        by: ["status"],
        where: { websiteId: { in: websiteIds } },
        _count: true,
      }),
      prisma.job.count({
        where: { websiteId: { in: websiteIds }, status: "FAILED" },
      }),
      prisma.organization.count({
        where: {
          OR: [
            { memberships: { some: { userId: session.user.id } } },
            { agency: { memberships: { some: { userId: session.user.id } } } },
          ],
        },
      }),
      isEmergencyStopped(),
      prisma.website.findMany({
        where: { id: { in: websiteIds } },
        select: { id: true, name: true, domain: true, cmsType: true },
        take: 4,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  const published = articles.find((a) => a.status === "PUBLISHED")?._count ?? 0;
  const pending = articles.find((a) => a.status === "PENDING_APPROVAL")?._count ?? 0;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Start here</p>
          <h1>Welcome to PulseRank</h1>
          <p className="lede">
            Simple flow: add a website → run SEO / keywords → generate blogs →
            publish. CMS optional — free audit & blogs work without WordPress.
          </p>
        </div>
        <div className="header-actions">
          <Link className="btn secondary" href="/agency/connect">
            How to connect
          </Link>
          <Link className="btn" href="/agency/websites">
            Open websites
          </Link>
        </div>
      </header>

      {emergency ? (
        <div className="disclaimer">
          Global emergency stop is ACTIVE. Jobs will not run until released in
          Settings.
        </div>
      ) : null}

      <section className="howto-grid" aria-label="How it works">
        <Link href="/agency/websites" className="howto-card">
          <span className="howto-num">1</span>
          <strong>Add website</strong>
          <span>
            Enter domain. Optional: connect WordPress / Shopify / Git so blogs
            can auto-publish in your site design.
          </span>
          <span className="btn secondary">Go to Websites</span>
        </Link>
        <Link href="/agency/websites" className="howto-card">
          <span className="howto-num">2</span>
          <strong>Analyze & keywords</strong>
          <span>
            Deep SEO audit + free Google keyword gaps. See what to write next —
            no paid SEO tools needed.
          </span>
          <span className="btn secondary">Open a site → Analyze</span>
        </Link>
        <Link href="/agency/articles" className="howto-card">
          <span className="howto-num">3</span>
          <strong>Write & publish</strong>
          <span>
            AI thinks, writes blog with internal links + image. If CMS connected
            → auto post. Else download / copy.
          </span>
          <span className="btn secondary">View articles</span>
        </Link>
      </section>

      <StatGrid
        items={[
          { label: "Organizations", value: orgs, kind: "measured" },
          { label: "Websites", value: websites, kind: "measured" },
          { label: "Published", value: published, kind: "measured" },
          { label: "Pending approval", value: pending, kind: "measured" },
          { label: "Failed jobs", value: failedJobs, kind: "measured" },
        ]}
      />

      <div className="panel-grid">
        <section className="panel panel-rich">
          <h2>What happens inside</h2>
          <ol className="pipeline">
            <li>Crawl your pages & check SEO issues</li>
            <li>Find keyword gaps (Google Suggest)</li>
            <li>AI researches & writes the article</li>
            <li>Matches your blog style (if CMS linked)</li>
            <li>Quality checks + featured image</li>
            <li>Publish or save for approval</li>
          </ol>
          <div className="disclaimer">
            Tips only — rankings are never guaranteed. Use data to decide what to
            publish.
          </div>
        </section>

        <section className="panel panel-rich">
          <h2>Your sites</h2>
          {recentSites.length ? (
            <div className="site-list">
              {recentSites.map((s) => (
                <Link
                  key={s.id}
                  href={`/agency/websites/${s.id}`}
                  className="site-row"
                >
                  <div>
                    <strong>{s.name}</strong>
                    <span className="muted">{s.domain}</span>
                  </div>
                  <span className="pill">{s.cmsType.replace("_", " ")}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">
              No websites yet. Click <strong>Open websites</strong> and add your
              first domain — takes under a minute.
            </p>
          )}
          <div className="stack link-stack">
            <Link href="/agency/articles">Review articles →</Link>
            <Link href="/agency/calendar">Publishing calendar →</Link>
            <Link href="/agency/jobs">Job logs →</Link>
            <Link href="/agency/settings">Settings & emergency stop →</Link>
          </div>
        </section>
      </div>
    </>
  );
}

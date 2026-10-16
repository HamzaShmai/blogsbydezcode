import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAccessibleWebsiteIds } from "@/lib/rbac";

export default async function AgencyBacklinksPage() {
  const session = await requireUser();
  const ids = await getAccessibleWebsiteIds(session.user.id);

  // Avoid Prisma `in: []` validation error; load counts separately for safety
  const websites =
    ids.length === 0
      ? []
      : await prisma.website.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, domain: true },
          orderBy: { updatedAt: "desc" },
        });

  const prospectRows =
    websites.length === 0
      ? []
      : await prisma.backlinkProspect.findMany({
          where: { websiteId: { in: websites.map((w) => w.id) } },
          orderBy: { score: "desc" },
          select: {
            websiteId: true,
            title: true,
            domain: true,
            score: true,
            kind: true,
          },
        });

  const bySite = new Map<
    string,
    { count: number; top?: { title: string; domain: string; score: number; kind: string } }
  >();
  for (const p of prospectRows) {
    const cur = bySite.get(p.websiteId) || { count: 0 };
    cur.count += 1;
    if (!cur.top) {
      cur.top = {
        title: p.title,
        domain: p.domain,
        score: p.score,
        kind: p.kind,
      };
    }
    bySite.set(p.websiteId, cur);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Link building</p>
          <h1>Backlinks</h1>
          <p className="lede">
            AI agent finds guest-post, resource, and directory sites for each
            website’s niche. Open a site to run the agent and manage outreach.
          </p>
        </div>
      </header>

      <div className="disclaimer">
        White-hat only. Lists are research recommendations — always verify the
        site and follow their guidelines before outreach.
      </div>

      <section className="panel panel-rich">
        <h2>Your websites</h2>
        {websites.length ? (
          <div className="site-list">
            {websites.map((w) => {
              const meta = bySite.get(w.id);
              return (
                <Link
                  key={w.id}
                  href={`/agency/websites/${w.id}`}
                  className="site-row"
                >
                  <div>
                    <strong>{w.name}</strong>
                    <span className="muted">
                      {w.domain} · {meta?.count ?? 0} prospects
                      {meta?.top ? ` · top: ${meta.top.domain}` : ""}
                    </span>
                  </div>
                  <span className="pill">Open agent →</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="muted">
            No websites yet.{" "}
            <Link href="/agency/websites">Add a website</Link> first.
          </p>
        )}
      </section>
    </>
  );
}

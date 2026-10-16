import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canAccessWebsite } from "@/lib/rbac";
import { getWebsiteAnalytics } from "@/services/analytics/report";
import { StatGrid } from "@/components/StatGrid";
import { DataTable } from "@/components/DataTable";

type Props = { params: Promise<{ id: string }> };

export default async function ClientWebsitePage({ params }: Props) {
  const session = await requireUser();
  const { id } = await params;
  if (!(await canAccessWebsite(session.user.id, id))) notFound();
  const website = await prisma.website.findUnique({ where: { id } });
  if (!website) notFound();
  const analytics = await getWebsiteAnalytics(id);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{website.name}</h1>
          <p className="muted">Credentials are hidden in the client portal.</p>
        </div>
      </header>
      <StatGrid
        items={[
          { label: "Clicks", value: analytics.measured.gsc.clicks, kind: "measured" },
          {
            label: "Impressions",
            value: analytics.measured.gsc.impressions,
            kind: "measured",
          },
          {
            label: "SEO health",
            value: analytics.measured.seoHealth ?? "—",
            kind: "measured",
          },
          {
            label: "Unresolved issues",
            value: analytics.measured.unresolvedIssues,
            kind: "measured",
          },
        ]}
      />
      <div className="disclaimer">
        Opportunity scores below are recommendations, not ranking guarantees.
      </div>
      <section className="panel">
        <h2>Content opportunities</h2>
        <DataTable
          headers={["Title", "Type", "Score"]}
          rows={analytics.recommendations.opportunities.map((o) => [
            o.title,
            o.type,
            o.score.toFixed(1),
          ])}
        />
      </section>
    </>
  );
}

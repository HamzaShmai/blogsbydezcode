import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canAccessWebsite } from "@/lib/rbac";
import { getWebsiteAnalytics } from "@/services/analytics/report";
import { StatGrid } from "@/components/StatGrid";
import { WebsiteActions } from "@/components/WebsiteActions";
import { WebsiteEasyWorkflow } from "@/components/WebsiteEasyWorkflow";
import { DeepAuditPanel } from "@/components/DeepAuditPanel";
import { BacklinksPanel } from "@/components/BacklinksPanel";
import { WordpressAutoPanel } from "@/components/WordpressAutoPanel";
import { DataTable } from "@/components/DataTable";

type Props = { params: Promise<{ id: string }> };

export default async function WebsiteDetailPage({ params }: Props) {
  const session = await requireUser();
  const { id } = await params;
  if (!(await canAccessWebsite(session.user.id, id))) notFound();

  const website = await prisma.website.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      domain: true,
      cmsType: true,
      gscTokensEnc: true,
      credentialsEnc: true,
      settings: true,
      categories: true,
      organization: { select: { id: true, name: true, slug: true, type: true } },
      seoAudits: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          healthScore: true,
          pagesCrawled: true,
        },
      },
    },
  });
  if (!website) notFound();

  const backlinkProspects = await prisma.backlinkProspect.findMany({
    where: { websiteId: id },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 120,
  });

  const hasGsc = Boolean(website.gscTokensEnc);
  const analytics = await getWebsiteAnalytics(id);
  const audit = website.seoAudits[0];

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{website.organization.name}</p>
          <h1>{website.name}</h1>
          <p className="lede">
            {website.domain} · {website.cmsType.replaceAll("_", " ")}
          </p>
        </div>
        <Link className="btn secondary" href="/agency/websites">
          All websites
        </Link>
      </header>

      <WebsiteEasyWorkflow websiteId={id} domain={website.domain} />

      <WordpressAutoPanel
        websiteId={id}
        domain={website.domain}
        hasCredentials={Boolean(website.credentialsEnc)}
        cmsType={website.cmsType}
      />

      <DeepAuditPanel
        websiteId={id}
        latestAuditId={audit?.id}
        latestScore={audit?.healthScore}
      />

      <BacklinksPanel
        websiteId={id}
        initial={backlinkProspects.map((p) => ({
          id: p.id,
          domain: p.domain,
          url: p.url,
          title: p.title,
          kind: p.kind,
          status: p.status,
          score: p.score,
          nicheFit: p.nicheFit,
          outreachAngle: p.outreachAngle,
          contactHint: p.contactHint,
          source: p.source,
        }))}
      />

      <StatGrid
        items={[
          {
            label: "GSC clicks (28d)",
            value: analytics.measured.gsc.clicks,
            kind: "measured",
          },
          {
            label: "Impressions",
            value: analytics.measured.gsc.impressions,
            kind: "measured",
          },
          {
            label: "Avg CTR",
            value: `${(analytics.measured.gsc.ctr * 100).toFixed(2)}%`,
            kind: "measured",
          },
          {
            label: "Avg position",
            value: analytics.measured.gsc.position.toFixed(1),
            kind: "measured",
          },
          {
            label: "SEO health",
            value: analytics.measured.seoHealth ?? "—",
            kind: "measured",
          },
          {
            label: "AI spend (est.)",
            value: `$${analytics.measured.usage.estimatedUsd.toFixed(2)}`,
            kind: "estimate",
          },
        ]}
      />

      <details className="panel panel-rich" style={{ marginBottom: "1rem" }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--font-display)" }}>
          Advanced jobs & settings
        </summary>
        <div style={{ marginTop: "1rem" }}>
          <WebsiteActions
            websiteId={id}
            settings={{
              autopilotEnabled: website.settings?.autopilotEnabled ?? false,
              publishMode: website.settings?.publishMode ?? "APPROVAL_REQUIRED",
              dailyPublishLimit: website.settings?.dailyPublishLimit ?? 1,
              weeklyPublishLimit: website.settings?.weeklyPublishLimit ?? 5,
              timezone: website.settings?.timezone ?? "UTC",
              aiProvider: website.settings?.aiProvider ?? "openai",
              imageProvider: website.settings?.imageProvider ?? "openai",
              maxUsageBudgetUsd: website.settings?.maxUsageBudgetUsd ?? 10,
              minQualityThreshold: website.settings?.minQualityThreshold ?? 0.7,
              automaticTechnicalFixes:
                website.settings?.automaticTechnicalFixes ?? false,
            }}
            hasGsc={hasGsc}
          />
        </div>
      </details>

      <section className="panel">
        <h2>Upcoming / pending</h2>
        <DataTable
          headers={["Title", "Status", "When"]}
          rows={analytics.operational.upcoming.map((a) => [
            <Link key={a.id} href={`/agency/articles/${a.id}`}>
              {a.title}
            </Link>,
            a.status,
            a.scheduledAt?.toISOString() ?? "—",
          ])}
        />
      </section>
    </>
  );
}

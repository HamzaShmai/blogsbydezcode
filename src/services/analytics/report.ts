import { DataKind } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getWebsiteAnalytics(websiteId: string) {
  const [
    snapshots,
    latestAudit,
    unresolvedIssues,
    articles,
    upcoming,
    failedJobs,
    usage,
    opportunities,
    topArticles,
  ] = await Promise.all([
    prisma.gscSnapshot.findMany({
      where: { websiteId },
      orderBy: { date: "desc" },
      take: 28,
    }),
    prisma.seoAudit.findFirst({
      where: { websiteId },
      orderBy: { startedAt: "desc" },
      include: { issues: { where: { resolved: false }, take: 20 } },
    }),
    prisma.seoIssue.count({
      where: { resolved: false, audit: { websiteId } },
    }),
    prisma.article.groupBy({
      by: ["status"],
      where: { websiteId },
      _count: true,
    }),
    prisma.article.findMany({
      where: {
        websiteId,
        status: { in: ["SCHEDULED", "PENDING_APPROVAL"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
    prisma.job.findMany({
      where: { websiteId, status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.usageRecord.findMany({
      where: { websiteId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.contentOpportunity.findMany({
      where: { websiteId, dismissed: false },
      orderBy: { score: "desc" },
      take: 10,
    }),
    prisma.article.findMany({
      where: { websiteId, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 10,
    }),
  ]);

  const gscTotals = snapshots.reduce(
    (acc, s) => {
      acc.clicks += s.clicks;
      acc.impressions += s.impressions;
      acc.ctr += s.ctr;
      acc.position += s.position;
      return acc;
    },
    { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  );
  const n = snapshots.length || 1;

  return {
    measured: {
      gsc: {
        clicks: gscTotals.clicks,
        impressions: gscTotals.impressions,
        ctr: gscTotals.ctr / n,
        position: gscTotals.position / n,
        kind: DataKind.MEASURED,
        days: snapshots.length,
      },
      seoHealth: latestAudit?.healthScore ?? null,
      unresolvedIssues,
      articleCounts: Object.fromEntries(articles.map((a) => [a.status, a._count])),
      usage: {
        records: usage.length,
        estimatedUsd: usage.reduce((s, u) => s + u.estimatedUsd, 0),
        kind: DataKind.ESTIMATE,
      },
      topArticles,
    },
    operational: {
      upcoming,
      failedJobs,
    },
    recommendations: {
      opportunities,
      kind: DataKind.RECOMMENDATION,
      disclaimer: "Recommendations are not ranking guarantees.",
    },
  };
}

export async function generateMonthlyReport(websiteId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const analytics = await getWebsiteAnalytics(websiteId);
  const summaryJson = JSON.stringify(analytics);

  const report = await prisma.monthlyReport.upsert({
    where: { websiteId_year_month: { websiteId, year, month } },
    create: {
      websiteId,
      year,
      month,
      summaryJson,
      kind: DataKind.MEASURED,
    },
    update: { summaryJson },
  });

  return { reportId: report.id, year, month };
}

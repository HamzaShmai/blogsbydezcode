import { DataKind, OpportunityType } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function discoverTopics(websiteId: string) {
  const website = await prisma.website.findUniqueOrThrow({
    where: { id: websiteId },
    include: { categories: true, articles: { select: { title: true, slug: true } } },
  });

  const queries = await prisma.gscQuery.findMany({
    where: { websiteId },
    orderBy: { impressions: "desc" },
    take: 50,
  });

  const pages = await prisma.gscPage.findMany({
    where: { websiteId },
    orderBy: { clicks: "asc" },
    take: 20,
  });

  const existingTitles = new Set(website.articles.map((a) => a.title.toLowerCase()));
  const opportunities = [];
  const recommendations = [];

  for (const page of pages) {
    if (page.impressions > 50 && page.ctr < 0.02) {
      const opp = await prisma.contentOpportunity.create({
        data: {
          websiteId,
          type: OpportunityType.DECLINING_PAGE,
          title: `Improve CTR for ${page.pageUrl}`,
          description:
            "Page has impressions but low CTR. Consider updating title/meta and supporting content.",
          score: Math.min(100, page.impressions / 10 + (1 - page.ctr) * 20),
          evidenceJson: JSON.stringify({
            pageUrl: page.pageUrl,
            clicks: page.clicks,
            impressions: page.impressions,
            ctr: page.ctr,
            kind: DataKind.MEASURED,
          }),
          kind: DataKind.RECOMMENDATION,
        },
      });
      opportunities.push(opp.id);
    }
  }

  for (const q of queries) {
    const title = `Complete guide to ${q.query}`;
    if (existingTitles.has(title.toLowerCase())) continue;

    const score =
      q.impressions * 0.4 +
      (q.position > 10 ? 20 : 5) +
      (q.ctr < 0.03 ? 10 : 0);

    const rec = await prisma.topicRecommendation.create({
      data: {
        websiteId,
        title,
        keyword: q.query,
        searchIntent: q.position > 20 ? "informational" : "commercial",
        score,
        rationale:
          "Based on Search Console query volume and position. Recommendation only — rankings are not guaranteed.",
        evidenceJson: JSON.stringify({
          query: q.query,
          clicks: q.clicks,
          impressions: q.impressions,
          position: q.position,
          kind: DataKind.MEASURED,
        }),
        kind: DataKind.RECOMMENDATION,
      },
    });
    recommendations.push(rec.id);
  }

  // Category-based content gap suggestions when GSC data is sparse
  if (recommendations.length < 3) {
    for (const cat of website.categories.slice(0, 5)) {
      const title = `${cat.name}: trends and best practices`;
      if (existingTitles.has(title.toLowerCase())) continue;
      const rec = await prisma.topicRecommendation.create({
        data: {
          websiteId,
          title,
          keyword: cat.name.toLowerCase(),
          searchIntent: "informational",
          score: 25,
          rationale:
            "Category-based topic suggestion when GSC coverage is limited. Labeled as recommendation.",
          evidenceJson: JSON.stringify({
            categoryId: cat.id,
            kind: DataKind.ESTIMATE,
          }),
          kind: DataKind.RECOMMENDATION,
        },
      });
      recommendations.push(rec.id);

      await prisma.contentOpportunity.create({
        data: {
          websiteId,
          type: OpportunityType.CONTENT_GAP,
          title: `Content gap in ${cat.name}`,
          description: "No recent articles mapped to this category.",
          score: 20,
          evidenceJson: JSON.stringify({ categoryId: cat.id }),
          kind: DataKind.RECOMMENDATION,
        },
      });
    }
  }

  return {
    opportunities: opportunities.length,
    recommendations: recommendations.length,
    note: "Topic scores are recommendations, not ranking guarantees.",
  };
}

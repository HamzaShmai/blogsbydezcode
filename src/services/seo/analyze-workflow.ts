import { DataKind, OpportunityType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { deepCrawlSite, aggregateSiteKeywords } from "@/services/seo/crawl-site";
import { findKeywordGaps } from "@/services/seo/keyword-gaps";
import { crawlSeoAudit } from "@/services/seo/audit";
import { buildNicheProfile } from "@/services/seo/niche";

/**
 * Easy path: deep page analysis → niche profile → on-topic keyword gaps → topics.
 */
export async function analyzeSiteAndKeywords(websiteId: string) {
  const website = await prisma.website.findUniqueOrThrow({
    where: { id: websiteId },
    include: {
      articles: { select: { title: true, slug: true } },
      categories: true,
    },
  });

  const pages = await deepCrawlSite(website.domain, 25);
  const siteKeywords = aggregateSiteKeywords(pages);

  const niche = buildNicheProfile({
    domain: website.domain,
    pages,
    categories: website.categories,
    siteKeywords,
  });

  const gscQueries = await prisma.gscQuery.findMany({
    where: { websiteId },
    orderBy: { impressions: "desc" },
    take: 40,
  });

  const gaps = await findKeywordGaps({
    siteKeywords: siteKeywords.map((k) => k.keyword),
    gscQueries: gscQueries.map((q) => q.query),
    existingTitles: website.articles.map((a) => a.title),
    existingSlugs: website.articles.map((a) => a.slug.replace(/-/g, " ")),
    niche,
  });

  // Drop unused off-niche topic suggestions (e.g. weather on an IT site)
  const { isOnNiche } = await import("@/services/seo/niche");
  const oldTopics = await prisma.topicRecommendation.findMany({
    where: {
      websiteId,
      selected: false,
      articles: { none: {} },
    },
    select: { id: true, keyword: true },
  });
  const offNicheIds = oldTopics
    .filter((t) => !isOnNiche(t.keyword, niche))
    .map((t) => t.id);
  if (offNicheIds.length) {
    await prisma.topicRecommendation.deleteMany({
      where: { id: { in: offNicheIds } },
    });
  }

  // Technical audit on crawled URLs (homepage + a few)
  const audit = await crawlSeoAudit(websiteId);

  let topicsCreated = 0;
  for (const gap of gaps.slice(0, 15)) {
    const title = `Complete guide to ${gap.keyword}`;
    const exists = await prisma.topicRecommendation.findFirst({
      where: { websiteId, keyword: gap.keyword },
    });
    if (exists) continue;

    const score =
      gap.source === "gsc" ? 70 : gap.source === "google_suggest" ? 55 : 40;

    await prisma.topicRecommendation.create({
      data: {
        websiteId,
        title,
        keyword: gap.keyword,
        searchIntent: "informational",
        score,
        rationale: `${gap.reason}. Niche: ${niche.label}. Recommendation only — not a ranking guarantee. Source: ${gap.source}.`,
        evidenceJson: JSON.stringify({
          source: gap.source,
          niche: niche.label,
          coreTerms: niche.coreTerms.slice(0, 8),
          pagesSample: pages.slice(0, 5).map((p) => p.url),
          kind: gap.source === "gsc" ? DataKind.MEASURED : DataKind.RECOMMENDATION,
        }),
        kind: DataKind.RECOMMENDATION,
      },
    });
    topicsCreated += 1;

    await prisma.contentOpportunity.create({
      data: {
        websiteId,
        type:
          gap.source === "gsc"
            ? OpportunityType.QUERY_OPPORTUNITY
            : OpportunityType.CONTENT_GAP,
        title: `Missing content: ${gap.keyword}`,
        description: gap.reason,
        score,
        evidenceJson: JSON.stringify(gap),
        kind: DataKind.RECOMMENDATION,
      },
    });
  }

  // Store crawl snapshot as opportunities meta for UI
  await prisma.contentOpportunity.create({
    data: {
      websiteId,
      type: OpportunityType.NEW_TOPIC,
      title: `Site crawl complete — ${pages.length} pages`,
      description: `Niche “${niche.label}”. Extracted ${siteKeywords.length} keyword signals. Found ${gaps.length} on-topic gaps.`,
      score: pages.length,
      evidenceJson: JSON.stringify({
        niche: { label: niche.label, coreTerms: niche.coreTerms.slice(0, 12) },
        pages: pages.map((p) => ({
          url: p.url,
          title: p.title,
          keywords: p.keywords.slice(0, 8),
        })),
        topKeywords: siteKeywords.slice(0, 30),
        gaps: gaps.slice(0, 20),
      }),
      kind: DataKind.MEASURED,
    },
  });

  return {
    pagesCrawled: pages.length,
    keywordsFound: siteKeywords.length,
    gapsFound: gaps.length,
    topicsCreated,
    audit,
    niche: niche.label,
    topKeywords: siteKeywords.slice(0, 20),
    gaps: gaps.slice(0, 15),
    disclaimer:
      `Suggestions filtered to your site niche (“${niche.label}”). Free crawl/Google Suggest signals — not official search volume.`,
  };
}

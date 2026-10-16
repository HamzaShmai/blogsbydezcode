import { DataKind } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Adjust recommendation feedback scores from subsequent GSC data.
 * Never claims guaranteed ranking improvements.
 */
export async function monitorGscFeedback(websiteId: string) {
  const published = await prisma.article.findMany({
    where: {
      websiteId,
      status: "PUBLISHED",
      publishedUrl: { not: null },
      publishedAt: { not: null },
    },
    include: { topic: true },
  });

  const pages = await prisma.gscPage.findMany({
    where: { websiteId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  let updated = 0;
  for (const article of published) {
    if (!article.topic || !article.publishedUrl) continue;
    const match = pages.find((p) => p.pageUrl.includes(article.slug));
    if (!match) continue;

    // Soft feedback: more clicks/impressions nudges the related keyword pattern
    const feedbackScore =
      Math.log10((match.clicks || 0) + 1) * 10 +
      Math.log10((match.impressions || 0) + 1) * 5 -
      (match.position || 0) * 0.2;

    await prisma.topicRecommendation.update({
      where: { id: article.topic.id },
      data: {
        feedbackScore,
        rationale: `${article.topic.rationale ?? ""}\n[Feedback ${new Date().toISOString()}] Measured GSC signals for published URL adjusted future topic scoring. Not a ranking guarantee.`,
      },
    });

    // Boost similar open recommendations sharing the keyword
    await prisma.topicRecommendation.updateMany({
      where: {
        websiteId,
        keyword: article.topic.keyword,
        selected: false,
        id: { not: article.topic.id },
      },
      data: {
        score: { increment: Math.min(5, Math.max(-2, feedbackScore / 10)) },
      },
    });
    updated += 1;
  }

  return {
    articlesReviewed: published.length,
    recommendationsUpdated: updated,
    kind: DataKind.MEASURED,
    disclaimer:
      "Feedback adjusts recommendation scores only; ranking improvements are never guaranteed.",
  };
}

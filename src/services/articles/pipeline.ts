import { ArticleStatus, PublishMode } from "@prisma/client";
import slugify from "slugify";
import { prisma } from "@/lib/db";
import { contentHash } from "@/lib/crypto";
import { researchTopic } from "@/services/research/search";
import { generateFeaturedImage } from "@/services/images/provider";
import { runQualityChecks } from "@/services/articles/quality";
import { enqueueJob } from "@/lib/queue";
import { JobType } from "@prisma/client";
import { thinkThenWriteArticle } from "@/services/articles/thinking";
import {
  adaptHtmlToBlogDesign,
  learnBlogStyle,
} from "@/services/seo/blog-style";
import { publishArticle } from "@/services/publish/service";
import { deepCrawlSite } from "@/services/seo/crawl-site";
import { buildNicheProfile, isOnNiche } from "@/services/seo/niche";
import {
  buildSeoPack,
  ensureKeywordInMarkdown,
  extractServices,
  highlightKeywordsInHtml,
} from "@/services/articles/seo-pack";
import { markdownToHtml } from "@/services/articles/html";

type GeneratedPayload = {
  title?: string;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  secondaryKeywords?: string[];
  tags?: string[];
  searchIntent?: string;
  slug?: string;
  outline?: string[];
  contentMarkdown?: string;
  faqs?: { q: string; a: string }[];
  citations?: { title: string; url: string }[];
};

/** Weave internal links into body paragraphs (not only a footer list). */
function weaveInternalLinks(
  md: string,
  links: { title: string; url: string }[]
): string {
  let out = md;
  let inserted = 0;
  for (const link of links.slice(0, 5)) {
    if (!link.url || out.includes(link.url)) continue;
    const words = link.title.split(/\s+/).filter((w) => w.length > 3);
    const needle = words.slice(0, 3).join(" ");
    if (needle.length < 4) continue;
    const re = new RegExp(
      `\\b(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`,
      "i"
    );
    if (!re.test(out)) continue;
    out = out.replace(re, `[$1](${link.url})`);
    inserted += 1;
    if (inserted >= 4) break;
  }
  return out;
}

export async function researchAndGenerate(
  websiteId: string,
  payload: Record<string, unknown>
) {
  const website = await prisma.website.findUniqueOrThrow({
    where: { id: websiteId },
    include: {
      settings: true,
      categories: true,
      articles: { select: { id: true, title: true, slug: true, publishedUrl: true } },
    },
  });
  const settings = website.settings;
  if (!settings) throw new Error("Website settings missing");

  // Niche + services from live site (so blogs stay on-topic)
  const crawlPages = await deepCrawlSite(website.domain, 12);
  const niche = buildNicheProfile({
    domain: website.domain,
    pages: crawlPages,
    categories: website.categories,
  });
  const services = extractServices({
    categories: website.categories.map((c) => c.name),
    headings: crawlPages.flatMap((p) => p.headings).slice(0, 80),
    titles: crawlPages.map((p) => p.title),
    urls: crawlPages.map((p) => p.url),
    nicheCore: niche.coreTerms,
  });

  let topic = payload.topicId
    ? await prisma.topicRecommendation.findFirst({
        where: { id: String(payload.topicId), websiteId },
      })
    : null;

  if (!topic) {
    const candidates = await prisma.topicRecommendation.findMany({
      where: { websiteId, selected: false },
      orderBy: [{ feedbackScore: "desc" }, { score: "desc" }],
      take: 25,
    });
    topic =
      candidates.find((t) => isOnNiche(t.keyword, niche)) ||
      candidates[0] ||
      null;
  }

  if (!topic) {
    const discovered = await import("@/services/seo/topics").then((m) =>
      m.discoverTopics(websiteId)
    );
    const fallbacks = await prisma.topicRecommendation.findMany({
      where: { websiteId },
      orderBy: { score: "desc" },
      take: 15,
    });
    topic =
      fallbacks.find((t) => isOnNiche(t.keyword, niche)) || fallbacks[0] || null;
    if (!topic) {
      return { skipped: true, reason: "no_topics", discovered };
    }
  }

  // Prefer research query tied to niche/services
  const researchQuery = [topic.keyword, services[0], niche.label]
    .filter(Boolean)
    .join(" ");
  const research = await researchTopic(researchQuery);
  const style = await learnBlogStyle(website.domain);
  const categoryId =
    settings.categoryIds[0] || website.categories[0]?.id || null;

  const internalLinks = [
    ...website.articles
      .filter((a) => a.publishedUrl)
      .slice(0, 8)
      .map((a) => ({ title: a.title, url: a.publishedUrl! })),
    ...crawlPages
      .filter((p) => /service|solution|about|product/i.test(p.url + p.title))
      .slice(0, 4)
      .map((p) => ({ title: p.title || p.h1 || p.url, url: p.url })),
  ];

  const thinking = await thinkThenWriteArticle({
    websiteId,
    provider: settings.aiProvider,
    topicTitle: topic.title,
    keyword: topic.keyword,
    searchIntent: topic.searchIntent,
    categories: website.categories.map((c) => c.name),
    nicheLabel: niche.label,
    nicheCore: niche.coreTerms,
    services,
    researchSummary: research.summary,
    hasLiveResearch: research.hasLiveResearch,
    sources: research.sources,
    internalLinks,
    style,
    domain: website.domain,
  });

  const generated = thinking.article as GeneratedPayload;
  const offline = thinking.offline;

  const title = generated.title || topic.title;
  const seoPack = buildSeoPack({
    title,
    focusKeyword: generated.focusKeyword || topic.keyword,
    secondaryKeywords: [
      ...(generated.secondaryKeywords || []),
      ...(generated.tags || []),
      ...services,
    ],
    seoTitle: generated.seoTitle,
    metaDescription: generated.metaDescription,
    nicheLabel: niche.label,
    services,
    domain: website.domain,
    searchIntent:
      generated.searchIntent || topic.searchIntent || "informational",
  });

  const slug =
    generated.slug ||
    seoPack.slugHint ||
    slugify(title, { lower: true, strict: true }).slice(0, 80) ||
    `article-${Date.now()}`;

  let contentMarkdown = generated.contentMarkdown || `# ${title}\n\n`;
  contentMarkdown = ensureKeywordInMarkdown(contentMarkdown, seoPack.focusKeyword);

  const linkTargets = [
    ...website.articles
      .filter((x) => x.publishedUrl)
      .slice(0, 8)
      .map((a) => ({ title: a.title, url: a.publishedUrl! })),
    ...internalLinks.filter((l) => l.url && !l.url.includes("#")),
  ];
  // Dedupe by URL
  const seenUrls = new Set<string>();
  const uniqueLinks = linkTargets.filter((l) => {
    const k = l.url.toLowerCase();
    if (seenUrls.has(k)) return false;
    seenUrls.add(k);
    return true;
  });

  contentMarkdown = weaveInternalLinks(contentMarkdown, uniqueLinks);
  if (uniqueLinks.length && !/##\s*Related|##\s*Internal/i.test(contentMarkdown)) {
    contentMarkdown += `\n\n## Related reading\n${uniqueLinks
      .slice(0, 6)
      .map((a) => `- [${a.title}](${a.url})`)
      .join("\n")}\n`;
  }

  if (generated.faqs?.length && !/##\s*FAQ/i.test(contentMarkdown)) {
    contentMarkdown += `\n\n## FAQ\n${generated.faqs
      .map((f) => `### ${f.q}\n${f.a}`)
      .join("\n\n")}`;
  }
  if (research.sources.length && generated.citations?.length) {
    const allowed = new Set(research.sources.map((s) => s.url));
    const valid = generated.citations.filter((c) => allowed.has(c.url));
    if (valid.length) {
      contentMarkdown += `\n\n## Sources\n${valid
        .map((c) => `- [${c.title}](${c.url})`)
        .join("\n")}`;
    }
  }

  let contentHtml = markdownToHtml(contentMarkdown);
  contentHtml = adaptHtmlToBlogDesign(contentHtml, style, website.cmsType);
  contentHtml = highlightKeywordsInHtml(contentHtml, [
    seoPack.focusKeyword,
    ...seoPack.secondaryKeywords.slice(0, 6),
  ]);

  const hash = contentHash(title, contentMarkdown);

  const quality = await runQualityChecks({
    websiteId,
    title,
    contentMarkdown,
    seoTitle: seoPack.seoTitle,
    metaDescription: seoPack.metaDescription,
    focusKeyword: seoPack.focusKeyword,
    slug,
    minThreshold: settings.minQualityThreshold,
  });

  if (quality.duplicateOfId) {
    await prisma.topicRecommendation.update({
      where: { id: topic.id },
      data: { selected: true },
    });
    return {
      skipped: true,
      reason: "duplicate",
      duplicateOfId: quality.duplicateOfId,
      quality,
    };
  }

  const image = await generateFeaturedImage({
    websiteId,
    title,
    focusKeyword: seoPack.focusKeyword,
    provider: settings.imageProvider === "placeholder" ? "placeholder" : settings.imageProvider,
  });

  const cmsConnected = Boolean(website.credentialsEnc);
  const forcePublish = Boolean(payload.forcePublish) || Boolean(payload.autoWordpress);
  let status: ArticleStatus = ArticleStatus.DRAFT;
  if (quality.passed) {
    if (!forcePublish && settings.publishMode === PublishMode.DRAFT_ONLY) {
      status = ArticleStatus.DRAFT;
    } else if (cmsConnected) {
      // CMS ready → prepare for immediate publish matching site design
      status = ArticleStatus.SCHEDULED;
    } else if (settings.publishMode === PublishMode.APPROVAL_REQUIRED) {
      status = ArticleStatus.PENDING_APPROVAL;
    } else {
      status = ArticleStatus.SCHEDULED;
    }
  }

  const article = await prisma.article.create({
    data: {
      websiteId,
      categoryId: categoryId ?? undefined,
      title,
      slug: `${slug}-${Date.now().toString(36)}`,
      status,
      contentHtml,
      contentMarkdown,
      excerpt: seoPack.metaDescription.slice(0, 160),
      seoTitle: seoPack.seoTitle,
      metaDescription: seoPack.metaDescription,
      tags: seoPack.tags,
      featuredImageUrl: image.url,
      featuredImageAlt: image.alt || `${seoPack.focusKeyword} — ${title}`,
      contentHash: hash,
      qualityScore: quality.score,
      topicId: topic.id,
      scheduledAt:
        status === ArticleStatus.SCHEDULED ? new Date() : undefined,
    },
  });

  await prisma.articleVersion.create({
    data: {
      articleId: article.id,
      version: 1,
      title,
      contentHtml,
      contentMarkdown,
      seoTitle: article.seoTitle,
      metaDescription: article.metaDescription,
      changeNote: offline
        ? "Generated offline (thinking pipeline)"
        : `Thinking pipeline via ${thinking.provider} · style-matched to ${website.domain}`,
    },
  });

  await prisma.articleAsset.create({
    data: {
      articleId: article.id,
      url: image.url,
      altText: image.alt,
      kind: "featured",
      provider: image.provider,
    },
  });

  await prisma.researchBrief.create({
    data: {
      articleId: article.id,
      query: topic.keyword,
      summary: `${research.summary}\n\nNiche: ${niche.label}\nServices: ${services.join(", ")}\nSEO focus: ${seoPack.focusKeyword}\nStrategy: ${JSON.stringify(thinking.brief).slice(0, 1200)}`,
      sourcesJson: JSON.stringify({
        sources: research.sources,
        seo: seoPack,
        niche: { label: niche.label, core: niche.coreTerms.slice(0, 10) },
        services,
        style: {
          avgWordCount: style.avgWordCount,
          sampleUrls: style.sampleUrls,
          toneNotes: style.toneNotes,
        },
      }),
      hasLiveResearch: research.hasLiveResearch,
    },
  });

  await prisma.outline.create({
    data: {
      articleId: article.id,
      headings: JSON.stringify(
        generated.outline ?? thinking.outline.outline ?? []
      ),
    },
  });

  for (const a of linkTargets.slice(0, 5)) {
    await prisma.internalLinkSuggestion.create({
      data: {
        articleId: article.id,
        targetUrl: a.publishedUrl!,
        anchorText: a.title,
        reason: "Style-matched internal link from site content graph",
        accepted: true,
      },
    });
  }

  await prisma.topicRecommendation.update({
    where: { id: topic.id },
    data: { selected: true },
  });

  let publishResult: unknown = null;
  const shouldAutoPublish =
    quality.passed &&
    cmsConnected &&
    (forcePublish || settings.publishMode !== PublishMode.DRAFT_ONLY) &&
    (await checkPublishLimits(websiteId, settings));

  if (shouldAutoPublish) {
    try {
      publishResult = await publishArticle(article.id, {
        verify: true,
        force: true,
      });
      await prisma.articleVersion.create({
        data: {
          articleId: article.id,
          version: 2,
          title,
          contentHtml,
          contentMarkdown,
          seoTitle: article.seoTitle,
          metaDescription: article.metaDescription,
          changeNote: "Auto-published to CMS using learned blog design",
        },
      });
    } catch (err) {
      await enqueueJob({
        type: JobType.PUBLISH_ARTICLE,
        websiteId,
        payload: { articleId: article.id, verify: true },
      }).catch(() => undefined);
      publishResult = {
        queued: true,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else if (
    quality.passed &&
    settings.publishMode === PublishMode.FULL_AUTOPILOT &&
    settings.autopilotEnabled
  ) {
    await enqueueJob({
      type: JobType.PUBLISH_ARTICLE,
      websiteId,
      payload: { articleId: article.id, verify: true },
    });
  }

  const fresh = await prisma.article.findUnique({ where: { id: article.id } });

  return {
    articleId: article.id,
    status: fresh?.status ?? article.status,
    publishedUrl: fresh?.publishedUrl,
    cmsPostId: fresh?.cmsPostId,
    quality,
    hasLiveResearch: research.hasLiveResearch,
    offline,
    provider: thinking.provider,
    styleMatched: {
      avgWordCount: style.avgWordCount,
      samples: style.sampleUrls,
      toneNotes: style.toneNotes,
    },
    seo: seoPack,
    searchIntent: seoPack.searchIntent,
    niche: niche.label,
    services,
    featuredImageAlt: image.alt,
    autoPublished: Boolean(
      publishResult &&
        typeof publishResult === "object" &&
        "status" in publishResult &&
        (publishResult as { status: string }).status === "PUBLISHED"
    ),
    publishResult,
    cmsConnected,
  };
}

async function checkPublishLimits(
  websiteId: string,
  settings: { dailyPublishLimit: number; weeklyPublishLimit: number }
) {
  const dayAgo = new Date(Date.now() - 86400000);
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [daily, weekly] = await Promise.all([
    prisma.article.count({
      where: { websiteId, status: "PUBLISHED", publishedAt: { gte: dayAgo } },
    }),
    prisma.article.count({
      where: { websiteId, status: "PUBLISHED", publishedAt: { gte: weekAgo } },
    }),
  ]);
  return daily < settings.dailyPublishLimit && weekly < settings.weeklyPublishLimit;
}

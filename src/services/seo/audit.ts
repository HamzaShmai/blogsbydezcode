import * as cheerio from "cheerio";
import { IssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/db";
export type FoundIssue = {
  pageUrl: string;
  code: string;
  message: string;
  severity: IssueSeverity;
};

export type PageAuditSnapshot = {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  wordCount: number;
  images: number;
  imagesMissingAlt: number;
  internalLinks: number;
  hasCanonical: boolean;
  hasOg: boolean;
  hasViewport: boolean;
  hasSchema: boolean;
  https: boolean;
};

export type AuditSummary = {
  domain: string;
  healthScore: number;
  pagesCrawled: number;
  issueCount: number;
  bySeverity: Record<string, number>;
  siteChecks: { code: string; ok: boolean; detail: string }[];
  pages: PageAuditSnapshot[];
  topIssues: { code: string; count: number; severity: string }[];
  recommendations: string[];
  generatedAt: string;
};

async function fetchHtml(url: string): Promise<{ html: string; status: number } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PulseRankBot/1.0 (+deep-seo-audit)" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return { html: "", status: res.status };
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text") && !ct.includes("html") && !ct.includes("xml")) {
      return { html: "", status: res.status };
    }
    return { html: await res.text(), status: res.status };
  } catch {
    return null;
  }
}

function analyzePage(pageUrl: string, html: string): {
  issues: FoundIssue[];
  snapshot: PageAuditSnapshot;
} {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const issues: FoundIssue[] = [];

  const title = $("title").first().text().trim();
  if (!title) {
    issues.push({
      pageUrl,
      code: "missing_title",
      message: "Page is missing a <title> tag",
      severity: IssueSeverity.ERROR,
    });
  } else if (title.length < 15 || title.length > 65) {
    issues.push({
      pageUrl,
      code: "title_length",
      message: `Title length ${title.length} is outside 15–65 characters`,
      severity: IssueSeverity.WARNING,
    });
  }

  const meta =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";
  if (!meta) {
    issues.push({
      pageUrl,
      code: "missing_meta_description",
      message: "Missing meta description",
      severity: IssueSeverity.WARNING,
    });
  } else if (meta.length < 50 || meta.length > 160) {
    issues.push({
      pageUrl,
      code: "meta_description_length",
      message: `Meta description length ${meta.length} is outside 50–160 characters`,
      severity: IssueSeverity.INFO,
    });
  }

  const h1Els = $("h1");
  const h1Count = h1Els.length;
  const h1 = h1Els.first().text().trim();
  if (h1Count === 0) {
    issues.push({
      pageUrl,
      code: "missing_h1",
      message: "No H1 heading found",
      severity: IssueSeverity.ERROR,
    });
  } else if (h1Count > 1) {
    issues.push({
      pageUrl,
      code: "multiple_h1",
      message: `Found ${h1Count} H1 headings`,
      severity: IssueSeverity.WARNING,
    });
  }

  let images = 0;
  let imagesMissingAlt = 0;
  $("img").each((_, el) => {
    images += 1;
    if (!$(el).attr("alt")?.trim()) {
      imagesMissingAlt += 1;
      if (imagesMissingAlt <= 8) {
        issues.push({
          pageUrl,
          code: "img_missing_alt",
          message: "Image missing alt text",
          severity: IssueSeverity.INFO,
        });
      }
    }
  });
  if (imagesMissingAlt > 8) {
    issues.push({
      pageUrl,
      code: "img_missing_alt_many",
      message: `${imagesMissingAlt} images missing alt text`,
      severity: IssueSeverity.WARNING,
    });
  }

  const hasCanonical = Boolean($('link[rel="canonical"]').attr("href"));
  if (!hasCanonical) {
    issues.push({
      pageUrl,
      code: "missing_canonical",
      message: "Missing canonical link",
      severity: IssueSeverity.INFO,
    });
  }

  const hasViewport = Boolean($('meta[name="viewport"]').attr("content"));
  if (!hasViewport) {
    issues.push({
      pageUrl,
      code: "missing_viewport",
      message: "Missing mobile viewport meta tag",
      severity: IssueSeverity.WARNING,
    });
  }

  const hasOg = Boolean($('meta[property="og:title"]').attr("content"));
  if (!hasOg) {
    issues.push({
      pageUrl,
      code: "missing_og_tags",
      message: "Missing Open Graph title (social sharing)",
      severity: IssueSeverity.INFO,
    });
  }

  const hasSchema =
    $('script[type="application/ld+json"]').length > 0 ||
    $("[itemtype]").length > 0;
  if (!hasSchema) {
    issues.push({
      pageUrl,
      code: "missing_schema",
      message: "No structured data (JSON-LD / microdata) detected",
      severity: IssueSeverity.INFO,
    });
  }

  const htmlLang = $("html").attr("lang")?.trim();
  if (!htmlLang) {
    issues.push({
      pageUrl,
      code: "missing_lang",
      message: "Missing html lang attribute",
      severity: IssueSeverity.INFO,
    });
  }

  const robots = $('meta[name="robots"]').attr("content")?.toLowerCase() || "";
  if (robots.includes("noindex")) {
    issues.push({
      pageUrl,
      code: "noindex",
      message: "Page has noindex — it will not appear in search",
      severity: IssueSeverity.CRITICAL,
    });
  }

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  if (wordCount > 0 && wordCount < 150) {
    issues.push({
      pageUrl,
      code: "thin_content",
      message: `Thin content (~${wordCount} words). Aim for richer page copy.`,
      severity: IssueSeverity.WARNING,
    });
  }

  const https = pageUrl.startsWith("https://");
  if (!https) {
    issues.push({
      pageUrl,
      code: "not_https",
      message: "Page is not served over HTTPS",
      severity: IssueSeverity.ERROR,
    });
  }

  // Heading order jump (H1 → H3)
  const headingLevels = $("h1, h2, h3, h4")
    .map((_, el) => Number(el.tagName?.replace(/h/i, "") || 0))
    .get()
    .filter(Boolean);
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i]! - headingLevels[i - 1]! > 1) {
      issues.push({
        pageUrl,
        code: "heading_skip",
        message: `Heading level jumps from H${headingLevels[i - 1]} to H${headingLevels[i]}`,
        severity: IssueSeverity.INFO,
      });
      break;
    }
  }

  let internalLinks = 0;
  try {
    const host = new URL(pageUrl).host;
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      try {
        const abs = new URL(href, pageUrl);
        if (abs.host === host) internalLinks += 1;
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }

  if (internalLinks < 2 && wordCount > 100) {
    issues.push({
      pageUrl,
      code: "few_internal_links",
      message: "Very few internal links — hurts crawlability and SEO",
      severity: IssueSeverity.INFO,
    });
  }

  return {
    issues,
    snapshot: {
      url: pageUrl,
      title,
      metaDescription: meta.slice(0, 200),
      h1,
      wordCount,
      images,
      imagesMissingAlt,
      internalLinks,
      hasCanonical,
      hasOg,
      hasViewport,
      hasSchema,
      https,
    },
  };
}

async function siteLevelChecks(root: string): Promise<{
  issues: FoundIssue[];
  checks: AuditSummary["siteChecks"];
}> {
  const issues: FoundIssue[] = [];
  const checks: AuditSummary["siteChecks"] = [];

  const robotsUrl = `${root}/robots.txt`;
  const robotsRes = await fetchHtml(robotsUrl);
  const robotsOk = Boolean(robotsRes?.html && robotsRes.status === 200 && robotsRes.html.length > 5);
  checks.push({
    code: "robots_txt",
    ok: robotsOk,
    detail: robotsOk ? "robots.txt found" : "robots.txt missing or empty",
  });
  if (!robotsOk) {
    issues.push({
      pageUrl: robotsUrl,
      code: "missing_robots_txt",
      message: "robots.txt not found — search engines lack crawl guidance",
      severity: IssueSeverity.WARNING,
    });
  }

  const sitemapCandidates = [
    `${root}/sitemap.xml`,
    `${root}/sitemap_index.xml`,
    `${root}/wp-sitemap.xml`,
  ];
  let sitemapOk = false;
  let sitemapUrl = sitemapCandidates[0]!;
  for (const sm of sitemapCandidates) {
    const smRes = await fetchHtml(sm);
    if (smRes?.html && smRes.status === 200 && smRes.html.includes("<loc")) {
      sitemapOk = true;
      sitemapUrl = sm;
      break;
    }
  }
  checks.push({
    code: "sitemap",
    ok: sitemapOk,
    detail: sitemapOk ? `Sitemap found at ${sitemapUrl}` : "No XML sitemap detected",
  });
  if (!sitemapOk) {
    issues.push({
      pageUrl: root,
      code: "missing_sitemap",
      message: "XML sitemap not found",
      severity: IssueSeverity.WARNING,
    });
  }

  // HTTPS redirect check for http root
  if (root.startsWith("https://")) {
    const httpRoot = root.replace(/^https:\/\//, "http://");
    try {
      const res = await fetch(httpRoot, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "PulseRankBot/1.0" },
      });
      const loc = res.headers.get("location") || "";
      const redirectsHttps =
        (res.status === 301 || res.status === 302 || res.status === 308) &&
        loc.startsWith("https://");
      checks.push({
        code: "http_to_https",
        ok: redirectsHttps || res.status === 0,
        detail: redirectsHttps
          ? "HTTP redirects to HTTPS"
          : `HTTP response ${res.status} (prefer 301 → HTTPS)`,
      });
      if (!redirectsHttps && res.status !== 404) {
        issues.push({
          pageUrl: httpRoot,
          code: "weak_https_redirect",
          message: "HTTP should permanently redirect to HTTPS",
          severity: IssueSeverity.WARNING,
        });
      }
    } catch {
      checks.push({
        code: "http_to_https",
        ok: true,
        detail: "HTTP endpoint not reachable (HTTPS-only is fine)",
      });
    }
  }

  return { issues, checks };
}

function buildRecommendations(
  bySeverity: Record<string, number>,
  topIssues: { code: string; count: number }[],
  checks: AuditSummary["siteChecks"]
): string[] {
  const recs: string[] = [];
  if ((bySeverity.CRITICAL || 0) + (bySeverity.ERROR || 0) > 0) {
    recs.push("Fix CRITICAL/ERROR issues first (titles, H1, HTTPS, noindex).");
  }
  if (topIssues.some((t) => t.code.includes("meta_description") || t.code === "missing_meta_description")) {
    recs.push("Write unique meta descriptions (50–160 chars) for key pages.");
  }
  if (topIssues.some((t) => t.code.includes("img_missing_alt"))) {
    recs.push("Add descriptive alt text to images for accessibility and image search.");
  }
  if (checks.some((c) => c.code === "sitemap" && !c.ok)) {
    recs.push("Publish an XML sitemap and submit it in Google Search Console.");
  }
  if (checks.some((c) => c.code === "robots_txt" && !c.ok)) {
    recs.push("Add a robots.txt that allows important paths and points to your sitemap.");
  }
  if (topIssues.some((t) => t.code === "missing_schema")) {
    recs.push("Add Organization/WebSite/Article JSON-LD structured data where relevant.");
  }
  if (topIssues.some((t) => t.code === "thin_content")) {
    recs.push("Expand thin pages with useful, niche-relevant content (300+ words on key URLs).");
  }
  if (!recs.length) {
    recs.push("Technical baseline looks solid — focus next on content and keyword coverage.");
  }
  return recs.slice(0, 8);
}

/** Deep multi-page SEO audit + site-level checks. */
export async function crawlSeoAudit(websiteId: string, opts?: { maxPages?: number }) {
  const website = await prisma.website.findUniqueOrThrow({ where: { id: websiteId } });
  const root = website.domain.startsWith("http")
    ? website.domain.replace(/\/$/, "")
    : `https://${website.domain.replace(/\/$/, "")}`;
  const maxPages = opts?.maxPages ?? 20;

  const audit = await prisma.seoAudit.create({
    data: { websiteId, startedAt: new Date() },
  });

  const allIssues: FoundIssue[] = [];
  const pages: PageAuditSnapshot[] = [];

  const site = await siteLevelChecks(root);
  allIssues.push(...site.issues);

  // Single-pass: discover URLs then fetch+analyze once each
  const { discoverSiteUrls } = await import("@/services/seo/crawl-site");
  const queue = await discoverSiteUrls(website.domain, maxPages);
  const seenTitles = new Map<string, string>();
  const visited = new Set<string>();

  for (const url of queue.length ? queue : [root]) {
    if (visited.size >= maxPages) break;
    const key = url.replace(/\/$/, "") || url;
    if (visited.has(key)) continue;
    visited.add(key);

    const fetched = await fetchHtml(url);
    if (!fetched?.html) {
      allIssues.push({
        pageUrl: url,
        code: "fetch_failed",
        message: fetched?.status
          ? `HTTP ${fetched.status} — could not audit page`
          : "Could not fetch page for audit",
        severity: IssueSeverity.ERROR,
      });
      continue;
    }

    const { issues, snapshot } = analyzePage(url, fetched.html);
    allIssues.push(...issues);
    pages.push(snapshot);

    const tKey = snapshot.title.toLowerCase();
    if (snapshot.title) {
      const prev = seenTitles.get(tKey);
      if (prev && prev !== url) {
        allIssues.push({
          pageUrl: url,
          code: "duplicate_title",
          message: `Duplicate title also used on ${prev}`,
          severity: IssueSeverity.WARNING,
        });
      } else {
        seenTitles.set(tKey, url);
      }
    }
  }

  // Cap issue flood (keep highest severity preference by sorting)
  const severityRank: Record<IssueSeverity, number> = {
    CRITICAL: 0,
    ERROR: 1,
    WARNING: 2,
    INFO: 3,
  };
  const capped = [...allIssues]
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 400);

  if (capped.length) {
    await prisma.seoIssue.createMany({
      data: capped.map((i) => ({
        auditId: audit.id,
        pageUrl: i.pageUrl,
        code: i.code,
        message: i.message,
        severity: i.severity,
      })),
    });
  }

  const bySeverity: Record<string, number> = {
    CRITICAL: 0,
    ERROR: 0,
    WARNING: 0,
    INFO: 0,
  };
  for (const i of capped) bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;

  const codeCounts = new Map<string, { count: number; severity: string }>();
  for (const i of capped) {
    const cur = codeCounts.get(i.code) || { count: 0, severity: i.severity };
    cur.count += 1;
    codeCounts.set(i.code, cur);
  }
  const topIssues = [...codeCounts.entries()]
    .map(([code, v]) => ({ code, count: v.count, severity: v.severity }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const weight: Record<IssueSeverity, number> = {
    INFO: 0.5,
    WARNING: 2,
    ERROR: 6,
    CRITICAL: 12,
  };
  // Soften penalty for deep crawls (many pages × INFO)
  const penalty = capped.reduce((sum, i) => sum + weight[i.severity], 0);
  const healthScore = Math.max(
    0,
    Math.min(100, Math.round(100 - penalty / Math.max(1, Math.sqrt(pages.length || 1))))
  );

  const recommendations = buildRecommendations(bySeverity, topIssues, site.checks);

  const summary: AuditSummary = {
    domain: website.domain,
    healthScore,
    pagesCrawled: pages.length,
    issueCount: capped.length,
    bySeverity,
    siteChecks: site.checks,
    pages: pages.slice(0, 40),
    topIssues,
    recommendations,
    generatedAt: new Date().toISOString(),
  };

  await prisma.seoAudit.update({
    where: { id: audit.id },
    data: {
      finishedAt: new Date(),
      pagesCrawled: pages.length,
      healthScore,
      verified: true,
      summaryJson: JSON.stringify(summary),
    },
  });

  return {
    auditId: audit.id,
    pagesCrawled: pages.length,
    issueCount: capped.length,
    healthScore,
    bySeverity,
    recommendations,
    summary,
  };
}

/** Only mark resolved after a fresh crawl confirms the issue is gone. */
export async function verifyIssueResolution(issueId: string) {
  const issue = await prisma.seoIssue.findUniqueOrThrow({
    where: { id: issueId },
    include: { audit: { include: { website: true } } },
  });

  const fetched = await fetchHtml(issue.pageUrl);
  if (!fetched?.html) {
    return { resolved: false, reason: "fetch_failed" };
  }

  const remaining = analyzePage(issue.pageUrl, fetched.html).issues.filter(
    (i) => i.code === issue.code
  );
  if (remaining.length === 0) {
    await prisma.seoIssue.update({
      where: { id: issueId },
      data: { resolved: true, resolvedAt: new Date(), verifiedAt: new Date() },
    });
    return { resolved: true, verified: true };
  }

  return { resolved: false, verified: true, reason: "still_present" };
}

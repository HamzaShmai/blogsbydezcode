import * as cheerio from "cheerio";

export type CrawledPage = {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  headings: string[];
  keywords: string[];
  internalLinks: string[];
};

function normalizeUrl(base: string, href: string): string | null {
  try {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return null;
    }
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString().replace(/\/$/, "") || u.origin;
  } catch {
    return null;
  }
}

function sameHost(a: string, b: string) {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PulseRankBot/1.0 (+seo-analysis)" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text") && !ct.includes("xml") && !ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractKeywords(text: string, boostText = ""): string[] {
  const stop = new Set(
    (
      "a an the and or but in on at to for of with by from as is are was were be been being " +
      "it this that these those you your we our they their i me my if then so not no yes can " +
      "will just about into over after before than too very also more most other some such " +
      "only own same both each few many much here there when where what which who how all " +
      "any every cookie privacy policy terms menu footer header sidebar login signup click " +
      "learn read more free get started home page contact us"
    ).split(/\s+/)
  );
  const tokenize = (raw: string) =>
    raw
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w) && !/^\d+$/.test(w));

  const words = tokenize(text);
  const boost = tokenize(boostText);

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  for (const w of boost) freq.set(w, (freq.get(w) || 0) + 4);

  for (let i = 0; i < words.length - 1; i++) {
    const bi = `${words[i]} ${words[i + 1]}`;
    if (bi.length > 8) freq.set(bi, (freq.get(bi) || 0) + 2);
  }
  for (let i = 0; i < boost.length - 1; i++) {
    const bi = `${boost[i]} ${boost[i + 1]}`;
    if (bi.length > 8) freq.set(bi, (freq.get(bi) || 0) + 6);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k]) => k);
}

function parsePage(url: string, html: string, root: string): CrawledPage {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";
  const h1 = $("h1").first().text().trim();
  const headings = $("h1, h2, h3")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 40);
  const bodyText = $("body").text().replace(/\s+/g, " ").slice(0, 12000);
  const important = `${title} ${h1} ${metaDescription} ${headings.slice(0, 20).join(" ")}`;
  const keywords = extractKeywords(`${important} ${bodyText}`, important);

  const internalLinks = new Set<string>();
  $("a[href]").each((_, el) => {
    const abs = normalizeUrl(url, $(el).attr("href") || "");
    if (abs && sameHost(abs, root)) internalLinks.add(abs);
  });

  return {
    url,
    title,
    metaDescription,
    h1,
    headings,
    keywords,
    internalLinks: [...internalLinks],
  };
}

async function urlsFromSitemap(root: string): Promise<string[]> {
  const candidates = [`${root}/sitemap.xml`, `${root}/sitemap_index.xml`, `${root}/wp-sitemap.xml`];
  const found: string[] = [];
  for (const sm of candidates) {
    const xml = await fetchText(sm);
    if (!xml) continue;
    const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
    for (const loc of locs) {
      if (loc.endsWith(".xml") && sameHost(loc, root)) {
        const nested = await fetchText(loc);
        if (nested) {
          const nestedLocs = [...nested.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) =>
            m[1].trim()
          );
          found.push(...nestedLocs.filter((u) => sameHost(u, root) && !u.endsWith(".xml")));
        }
      } else if (sameHost(loc, root)) {
        found.push(loc);
      }
    }
    if (found.length) break;
  }
  return [...new Set(found)];
}

/** Discover URLs only (homepage + sitemap) — no full page parse. */
export async function discoverSiteUrls(domain: string, maxUrls = 40): Promise<string[]> {
  const root = domain.startsWith("http")
    ? domain.replace(/\/$/, "")
    : `https://${domain.replace(/\/$/, "")}`;
  const urls = new Set<string>([root]);
  const sitemapUrls = await urlsFromSitemap(root);
  for (const u of sitemapUrls.slice(0, maxUrls)) {
    urls.add(u.replace(/\/$/, "") || u);
  }
  // Seed a few links from homepage
  const homeHtml = await fetchText(root);
  if (homeHtml) {
    const page = parsePage(root, homeHtml, root);
    for (const link of page.internalLinks.slice(0, maxUrls)) {
      urls.add(link.replace(/\/$/, "") || link);
    }
  }
  return [...urls].slice(0, maxUrls);
}

/** Deep crawl: homepage → sitemap → internal links (capped). */
export async function deepCrawlSite(domain: string, maxPages = 25): Promise<CrawledPage[]> {
  const root = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/\/$/, "")}`;
  const queue = new Set<string>([root, `${root}/`]);
  const sitemapUrls = await urlsFromSitemap(root);
  for (const u of sitemapUrls.slice(0, maxPages)) queue.add(u.replace(/\/$/, "") || u);

  const pages: CrawledPage[] = [];
  const visited = new Set<string>();
  const queueList = [...queue];

  while (queueList.length && pages.length < maxPages) {
    const url = queueList.shift()!;
    const key = url.replace(/\/$/, "") || url;
    if (visited.has(key)) continue;
    visited.add(key);

    const html = await fetchText(url);
    if (!html || !html.includes("<")) continue;
    const page = parsePage(url, html, root);
    pages.push(page);
    for (const link of page.internalLinks) {
      const k = link.replace(/\/$/, "") || link;
      if (!visited.has(k) && queueList.length + pages.length < maxPages * 2) {
        queueList.push(link);
      }
    }
  }

  return pages;
}

export function aggregateSiteKeywords(pages: CrawledPage[]): { keyword: string; score: number; sources: number }[] {
  const map = new Map<string, { score: number; sources: number }>();
  for (const page of pages) {
    page.keywords.forEach((kw, idx) => {
      const weight = Math.max(1, 20 - idx);
      const cur = map.get(kw) || { score: 0, sources: 0 };
      cur.score += weight;
      cur.sources += 1;
      map.set(kw, cur);
    });
  }
  return [...map.entries()]
    .map(([keyword, v]) => ({ keyword, score: v.score, sources: v.sources }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);
}

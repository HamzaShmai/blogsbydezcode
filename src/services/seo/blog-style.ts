import * as cheerio from "cheerio";

export type BlogStyleProfile = {
  sampleUrls: string[];
  toneNotes: string;
  avgWordCount: number;
  headingStyle: string;
  usesFaq: boolean;
  usesLists: boolean;
  titlePatterns: string[];
  htmlHints: string[];
  voiceSamples: string[];
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PulseRankBot/1.0 (+style-profile)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function discoverBlogUrls(root: string, html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    try {
      const u = new URL(href, root);
      if (u.origin !== new URL(root).origin) return;
      const path = u.pathname.toLowerCase();
      if (
        /\/(blog|news|articles|posts|insights|resources)\//i.test(path) ||
        /\/(blog|news|articles)\/?$/i.test(path)
      ) {
        urls.add(u.toString().replace(/\/$/, ""));
      }
    } catch {
      /* ignore */
    }
  });
  return [...urls].slice(0, 12);
}

function profileArticle(url: string, html: string) {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header").remove();
  const title = $("h1").first().text().trim() || $("title").text().trim();
  const article =
    $("article").text() ||
    $("main").text() ||
    $(".post, .entry-content, .blog-content").text() ||
    $("body").text();
  const text = article.replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const h2 = $("h2").length;
  const h3 = $("h3").length;
  const lists = $("ul, ol").length;
  const faq =
    /faq|frequently asked/i.test(text) ||
    $('[itemtype*="FAQPage"]').length > 0;
  const sample = text.slice(0, 420);

  return { url, title, words, h2, h3, lists, faq, sample };
}

/**
 * Learn how this website already writes/presents blogs so new posts match design & voice.
 */
export async function learnBlogStyle(domain: string): Promise<BlogStyleProfile> {
  const root = domain.startsWith("http")
    ? domain.replace(/\/$/, "")
    : `https://${domain.replace(/\/$/, "")}`;

  const home = await fetchHtml(root);
  const candidates = new Set<string>([
    `${root}/blog`,
    `${root}/blogs`,
    `${root}/news`,
    `${root}/articles`,
    `${root}/insights`,
  ]);

  if (home) {
    for (const u of discoverBlogUrls(root, home)) candidates.add(u);
    const blogIndex = await fetchHtml(`${root}/blog`);
    if (blogIndex) {
      for (const u of discoverBlogUrls(root, blogIndex)) candidates.add(u);
    }
  }

  const profiles = [];
  for (const url of [...candidates].slice(0, 8)) {
    const html = await fetchHtml(url);
    if (!html || html.length < 800) continue;
    // skip pure index pages with tiny content
    const p = profileArticle(url, html);
    if (p.words < 120) continue;
    profiles.push(p);
  }

  if (!profiles.length) {
    return {
      sampleUrls: [],
      toneNotes: "No existing blog samples found — use clear, professional, helpful voice.",
      avgWordCount: 1200,
      headingStyle: "H2 sections with short H3 subheads",
      usesFaq: true,
      usesLists: true,
      titlePatterns: ["How to…", "Complete guide to…"],
      htmlHints: [
        "Use semantic h2/h3",
        "Short paragraphs (2–4 sentences)",
        "Bullet lists for steps",
      ],
      voiceSamples: [],
    };
  }

  const avgWordCount = Math.round(
    profiles.reduce((s, p) => s + p.words, 0) / profiles.length
  );
  const usesFaq = profiles.filter((p) => p.faq).length >= profiles.length / 2;
  const usesLists = profiles.filter((p) => p.lists > 0).length >= profiles.length / 2;
  const avgH2 = profiles.reduce((s, p) => s + p.h2, 0) / profiles.length;

  return {
    sampleUrls: profiles.map((p) => p.url).slice(0, 5),
    toneNotes: `Match existing site posts: practical, scannable, around ${avgWordCount} words. Titles similar to: ${profiles
      .map((p) => p.title)
      .filter(Boolean)
      .slice(0, 3)
      .join(" | ")}`,
    avgWordCount: Math.min(2200, Math.max(700, avgWordCount)),
    headingStyle:
      avgH2 >= 3
        ? "Multiple H2 sections with supporting H3s"
        : "Fewer broader H2 sections",
    usesFaq,
    usesLists,
    titlePatterns: profiles.map((p) => p.title).filter(Boolean).slice(0, 5),
    htmlHints: [
      "Mirror existing post structure and density",
      usesLists ? "Include bullet/numbered lists like current posts" : "Prefer prose paragraphs",
      usesFaq ? "Include an FAQ block near the end" : "Skip FAQ unless truly useful",
      "Keep featured-image-friendly short intro",
    ],
    voiceSamples: profiles.map((p) => p.sample).slice(0, 3),
  };
}

/** Adapt generated HTML to common CMS blog markup patterns. */
export function adaptHtmlToBlogDesign(
  html: string,
  style: BlogStyleProfile,
  cmsType: string
): string {
  let out = html
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (block) => `<ul>\n${block}</ul>\n`);

  // WordPress often wraps content cleanly; Shopify wants body_html
  if (cmsType === "WORDPRESS" || cmsType === "SHOPIFY") {
    out = out.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, ""); // title usually separate field
  }

  if (style.usesLists && !out.includes("<ul>") && !out.includes("<ol>")) {
    // leave as-is; generator should have lists
  }

  // Ensure paragraphs aren't one giant block
  out = out.replace(/<p>([^<]{400,})<\/p>/g, (_, long: string) => {
    const parts = long.split(/(?<=\.)\s+/).filter(Boolean);
    if (parts.length < 2) return `<p>${long}</p>`;
    return parts.map((p) => `<p>${p.trim()}</p>`).join("\n");
  });

  return out.trim();
}

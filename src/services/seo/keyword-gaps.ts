/**
 * Free keyword expansion via Google Suggest (no API key).
 * Filtered to the website's niche so IT sites don't get weather (etc.) suggestions.
 */

import {
  type NicheProfile,
  contextualizeSeed,
  isGoodSeed,
  isOnNiche,
  nicheRelevanceScore,
} from "@/services/seo/niche";

export type KeywordGap = {
  keyword: string;
  source: "google_suggest" | "site_crawl" | "gsc";
  reason: string;
  covered: boolean;
};

async function googleSuggest(seed: string): Promise<string[]> {
  try {
    const url = new URL("https://suggestqueries.google.com/complete/search");
    url.searchParams.set("client", "firefox");
    url.searchParams.set("q", seed);
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "PulseRankBot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[]];
    return Array.isArray(data?.[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

function coveredByContent(keyword: string, existing: string[]): boolean {
  const k = keyword.toLowerCase();
  return existing.some((t) => {
    const x = t.toLowerCase();
    return x.includes(k) || k.split(" ").every((p) => p.length < 3 || x.includes(p));
  });
}

export async function findKeywordGaps(input: {
  siteKeywords: string[];
  gscQueries: string[];
  existingTitles: string[];
  existingSlugs: string[];
  niche: NicheProfile;
}): Promise<KeywordGap[]> {
  const { niche } = input;

  // Prefer niche seed phrases, then on-niche multi-word site keywords, then GSC
  const seeds = [
    ...niche.seedPhrases,
    ...input.siteKeywords.filter((k) => isGoodSeed(k, niche) && k.includes(" ")).slice(0, 10),
    ...input.gscQueries.filter((q) => isOnNiche(q, niche)).slice(0, 8),
    ...niche.coreTerms.filter((k) => k.includes(" ")).slice(0, 6),
  ]
    .map((s) => contextualizeSeed(s, niche))
    .filter((s, i, arr) => arr.indexOf(s) === i && isGoodSeed(s, niche))
    .slice(0, 14);

  const existing = [...input.existingTitles, ...input.existingSlugs];
  const gaps: KeywordGap[] = [];
  const seen = new Set<string>();

  const pushGap = (gap: KeywordGap) => {
    const key = gap.keyword.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    if (!isOnNiche(key, niche)) return;
    seen.add(key);
    gaps.push(gap);
  };

  for (const seed of seeds) {
    const suggestions = await googleSuggest(seed);
    for (const s of suggestions) {
      if (coveredByContent(s, existing)) continue;
      pushGap({
        keyword: s,
        source: "google_suggest",
        reason: `Related to your site niche (“${niche.label}”) via “${seed}” — no matching article yet`,
        covered: false,
      });
    }
  }

  // Site phrases that look like topics but have no article
  for (const kw of input.siteKeywords.slice(0, 40)) {
    if (!kw.includes(" ") || !isOnNiche(kw, niche)) continue;
    if (coveredByContent(kw, existing)) continue;
    pushGap({
      keyword: kw,
      source: "site_crawl",
      reason: "Found on your pages but no dedicated blog targeting it",
      covered: false,
    });
  }

  for (const q of input.gscQueries.slice(0, 25)) {
    if (!isOnNiche(q, niche)) continue;
    if (coveredByContent(q, existing)) continue;
    pushGap({
      keyword: q,
      source: "gsc",
      reason: "Search Console query for your niche without a matching article",
      covered: false,
    });
  }

  // If Suggest returned almost nothing on-niche, surface top niche phrases as gaps
  if (gaps.length < 5) {
    for (const phrase of niche.seedPhrases.slice(0, 10)) {
      if (coveredByContent(phrase, existing)) continue;
      pushGap({
        keyword: phrase,
        source: "site_crawl",
        reason: "Core topic from your website content — good candidate for a blog",
        covered: false,
      });
    }
  }

  return gaps
    .sort(
      (a, b) =>
        nicheRelevanceScore(b.keyword, niche) - nicheRelevanceScore(a.keyword, niche) ||
        (a.source === "gsc" ? -1 : 1)
    )
    .slice(0, 40);
}

import type { CrawledPage } from "@/services/seo/crawl-site";

/** Words that pollute crawl keywords / Google Suggest seeds. */
const NOISE = new Set(
  (
    "home page menu cookie privacy policy terms login signup contact about us " +
    "click here learn more read more get started free trial subscribe newsletter " +
    "copyright reserved rights all rights reserved powered wordpress shopify " +
    "facebook twitter linkedin instagram youtube google apple microsoft " +
    "monday tuesday wednesday thursday friday saturday sunday january february " +
    "hours phone email address city country state zip cart checkout buy now " +
    "skip content main footer header sidebar search results loading error " +
    "your yoursthey them from with this that have been will were what when where"
  ).split(/\s+/)
);

/** Single words that often send Suggest into the wrong industry. */
const AMBIGUOUS_SEEDS = new Set([
  "cloud",
  "storm",
  "front",
  "outlook",
  "apple",
  "java",
  "python",
  "ruby",
  "go",
  "swift",
  "pressure",
  "climate",
  "weather",
  "forecast",
  "rain",
  "wind",
  "temperature",
  "snow",
  "sun",
  "moon",
  "star",
  "orbit",
  "space",
  "bank",
  "orange",
  "delta",
  "amazon",
  "meta",
  "drive",
  "office",
  "word",
  "excel",
  "power",
  "force",
  "energy",
  "service",
  "services",
  "solution",
  "solutions",
  "best",
  "top",
  "guide",
  "tips",
  "how",
  "what",
  "why",
  "near",
  "online",
  "free",
  "cheap",
  "company",
  "business",
  "digital",
  "smart",
  "data",
  "system",
  "systems",
  "platform",
  "app",
  "apps",
  "web",
  "site",
  "website",
  "blog",
  "news",
  "info",
  "help",
  "support",
]);

export type NicheProfile = {
  domain: string;
  brandTokens: string[];
  coreTerms: string[];
  vocab: Set<string>;
  seedPhrases: string[];
  label: string;
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s/-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !NOISE.has(t) && !/^\d+$/.test(t));
}

function domainTokens(domain: string): string[] {
  try {
    const host = new URL(
      domain.startsWith("http") ? domain : `https://${domain}`
    ).hostname.replace(/^www\./, "");
    return host
      .split(".")
      .flatMap((part) => part.split(/[-_]/))
      .filter((p) => p.length > 2 && !["com", "net", "org", "io", "co", "uk", "pk", "app", "dev"].includes(p));
  } catch {
    return [];
  }
}

function phraseScore(phrase: string, freq: Map<string, number>): number {
  const parts = phrase.split(/\s+/);
  let s = freq.get(phrase) || 0;
  for (const p of parts) s += (freq.get(p) || 0) * 0.25;
  return s;
}

/**
 * Build what the site is about from crawl + domain + categories.
 * Used to keep keyword suggestions on-niche.
 */
export function buildNicheProfile(input: {
  domain: string;
  pages: CrawledPage[];
  categories?: { name: string }[];
  siteKeywords?: { keyword: string; score: number }[];
}): NicheProfile {
  const brandTokens = domainTokens(input.domain);
  const freq = new Map<string, number>();

  const bump = (text: string, weight: number) => {
    for (const t of tokens(text)) {
      freq.set(t, (freq.get(t) || 0) + weight);
    }
    const words = tokens(text);
    for (let i = 0; i < words.length - 1; i++) {
      const bi = `${words[i]} ${words[i + 1]}`;
      if (bi.length > 6) freq.set(bi, (freq.get(bi) || 0) + weight * 1.5);
    }
  };

  for (const b of brandTokens) bump(b, 12);
  for (const cat of input.categories || []) bump(cat.name, 10);

  for (const page of input.pages) {
    bump(page.title, 8);
    bump(page.h1, 7);
    bump(page.metaDescription, 6);
    for (const h of page.headings.slice(0, 12)) bump(h, 4);
    for (const kw of page.keywords.slice(0, 10)) bump(kw, 3);
  }

  for (const kw of input.siteKeywords || []) {
    bump(kw.keyword, Math.min(8, kw.score / 5));
  }

  // Drop pure noise / ultra-generic singles from core
  const ranked = [...freq.entries()]
    .filter(([k]) => {
      if (NOISE.has(k)) return false;
      if (!k.includes(" ") && AMBIGUOUS_SEEDS.has(k) && !brandTokens.includes(k)) {
        return (freq.get(k) || 0) >= 10; // only keep if strongly present
      }
      return true;
    })
    .sort((a, b) => b[1] - a[1]);

  const coreTerms = ranked
    .map(([k]) => k)
    .filter((k) => k.includes(" ") || k.length > 4)
    .slice(0, 24);

  const vocab = new Set<string>();
  for (const [k] of ranked.slice(0, 120)) {
    vocab.add(k);
    for (const t of k.split(/\s+/)) if (t.length > 2) vocab.add(t);
  }
  for (const b of brandTokens) vocab.add(b);

  // Prefer multi-word niche seeds for Google Suggest
  const seedPhrases = ranked
    .map(([k]) => k)
    .filter((k) => k.includes(" ") && k.split(/\s+/).length <= 4)
    .filter((k) => !k.split(/\s+/).every((p) => AMBIGUOUS_SEEDS.has(p)))
    .slice(0, 16);

  // Also build "brand + service" style seeds from strong singles
  const strongSingles = ranked
    .map(([k]) => k)
    .filter((k) => !k.includes(" ") && !AMBIGUOUS_SEEDS.has(k) && k.length > 3)
    .slice(0, 8);

  for (const a of strongSingles.slice(0, 4)) {
    for (const b of strongSingles.slice(0, 6)) {
      if (a === b) continue;
      const phrase = `${a} ${b}`;
      if (phraseScore(phrase, freq) > 0 || seedPhrases.length < 10) {
        if (!seedPhrases.includes(phrase)) seedPhrases.push(phrase);
      }
    }
  }

  const label =
    coreTerms.slice(0, 3).join(", ") ||
    brandTokens.join(" ") ||
    input.domain;

  return {
    domain: input.domain,
    brandTokens,
    coreTerms: coreTerms.slice(0, 20),
    vocab,
    seedPhrases: seedPhrases.slice(0, 14),
    label,
  };
}

function meaningfulParts(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/[\s/-]+/)
    .filter((p) => p.length > 2 && !NOISE.has(p) && !AMBIGUOUS_SEEDS.has(p));
}

/**
 * Keep only suggestions that share meaning with the site niche.
 * Rejects e.g. weather keywords for an IT company.
 */
export function isOnNiche(keyword: string, niche: NicheProfile): boolean {
  const k = keyword.toLowerCase().trim();
  if (!k || k.length < 4) return false;
  if (NOISE.has(k)) return false;

  // Hard reject common off-niche weather/climate phrases unless site is about them
  const weatherish =
    /\b(weather|forecast|temperature|humidity|rainfall|climate change|storm warning|uv index|wind speed|barometric)\b/i;
  const siteIsWeather = [...niche.vocab].some((v) =>
    /weather|forecast|climate|meteorology|temperature/.test(v)
  );
  if (weatherish.test(k) && !siteIsWeather) return false;

  const parts = k.split(/[\s/-]+/).filter((p) => p.length > 2);
  if (!parts.length) return false;

  // Brand mention = always on niche
  if (niche.brandTokens.some((b) => k.includes(b))) return true;

  // Exact / substring match against core phrases
  if (niche.coreTerms.some((c) => k.includes(c) || c.includes(k))) return true;

  const meaningful = meaningfulParts(k);
  const overlap = meaningful.filter((p) => niche.vocab.has(p));
  const weakOverlap = parts.filter((p) => niche.vocab.has(p));

  // Multi-word: need ≥1 strong niche token (non-ambiguous)
  if (parts.length >= 2) {
    if (overlap.length >= 1) return true;
    if (weakOverlap.length >= 2) return true;
    return false;
  }

  // Single word: must be in vocab and not ambiguous unless branded
  if (AMBIGUOUS_SEEDS.has(k)) return false;
  return niche.vocab.has(k) && (freqRankHint(k, niche) || k.length > 5);
}

function freqRankHint(term: string, niche: NicheProfile): boolean {
  return niche.coreTerms.some((c) => c === term || c.includes(term) || term.includes(c));
}

/** Qualify a seed before sending to Google Suggest. */
export function isGoodSeed(seed: string, niche: NicheProfile): boolean {
  const s = seed.toLowerCase().trim();
  if (!s || s.length < 4) return false;
  if (!s.includes(" ") && AMBIGUOUS_SEEDS.has(s)) return false;
  return isOnNiche(s, niche) || niche.seedPhrases.includes(s);
}

/**
 * Contextualize short seeds so Suggest stays in industry
 * e.g. "cloud" + IT site → "cloud computing" / "cloud hosting"
 */
export function contextualizeSeed(seed: string, niche: NicheProfile): string {
  const s = seed.toLowerCase().trim();
  if (s.includes(" ") && isGoodSeed(s, niche)) return s;

  if (AMBIGUOUS_SEEDS.has(s) || s.split(/\s+/).length === 1) {
    const anchor =
      niche.coreTerms.find((c) => c.includes(" ") && !c.includes(s)) ||
      niche.coreTerms.find((c) => !AMBIGUOUS_SEEDS.has(c.split(" ")[0]!)) ||
      niche.brandTokens[0];
    if (anchor && !s.includes(anchor)) {
      return `${s} ${anchor}`.trim();
    }
  }
  return s;
}

export function nicheRelevanceScore(keyword: string, niche: NicheProfile): number {
  const parts = keyword.toLowerCase().split(/[\s/-]+/).filter((p) => p.length > 2);
  let score = 0;
  for (const p of parts) {
    if (niche.brandTokens.includes(p)) score += 5;
    if (niche.vocab.has(p) && !AMBIGUOUS_SEEDS.has(p)) score += 3;
    else if (niche.vocab.has(p)) score += 1;
  }
  if (niche.coreTerms.some((c) => keyword.toLowerCase().includes(c))) score += 4;
  return score;
}

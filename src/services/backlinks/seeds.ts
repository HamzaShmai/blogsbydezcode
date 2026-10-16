import { BacklinkKind } from "@prisma/client";

export type BacklinkAgentItem = {
  domain: string;
  url: string;
  title: string;
  kind: BacklinkKind;
  score: number;
  nicheFit: string;
  outreachAngle: string;
  contactHint: string;
};

type Seed = Omit<BacklinkAgentItem, "nicheFit" | "outreachAngle"> & {
  match: RegExp;
  nicheFit: string;
  outreachAngle: string;
};

/**
 * Curated white-hat opportunity sites. Matched to niche keywords when live search is empty.
 */
const SEEDS: Seed[] = [
  // IT / software / agency
  {
    match: /it|software|web|app|saas|digital|tech|develop|cloud|cyber|host|agency|imple/i,
    domain: "clutch.co",
    url: "https://clutch.co/",
    title: "Clutch — B2B ratings & reviews",
    kind: BacklinkKind.DIRECTORY,
    score: 78,
    contactHint: "Claim/profile + content marketing pages",
    nicheFit: "IT & digital agency directory",
    outreachAngle: "Create a complete company profile and publish client case studies.",
  },
  {
    match: /it|software|web|app|saas|digital|tech|develop|agency|imple/i,
    domain: "goodfirms.co",
    url: "https://www.goodfirms.co/",
    title: "GoodFirms — software & agency listing",
    kind: BacklinkKind.DIRECTORY,
    score: 74,
    contactHint: "Submit company listing",
    nicheFit: "Software / IT firm directory",
    outreachAngle: "List your services and request reviews for a profile backlink.",
  },
  {
    match: /it|software|web|app|digital|design|marketing|agency|imple/i,
    domain: "designrush.com",
    url: "https://www.designrush.com/",
    title: "DesignRush agency directory",
    kind: BacklinkKind.DIRECTORY,
    score: 72,
    contactHint: "Agency submission / featured listing",
    nicheFit: "Web & digital agency directory",
    outreachAngle: "Apply for category listing matching your services.",
  },
  {
    match: /it|software|web|saas|tech|develop|cloud/i,
    domain: "g2.com",
    url: "https://www.g2.com/",
    title: "G2 — software reviews",
    kind: BacklinkKind.DIRECTORY,
    score: 80,
    contactHint: "Vendor profile",
    nicheFit: "SaaS / software directory",
    outreachAngle: "Add product/service profile if you ship software tools.",
  },
  {
    match: /it|software|web|saas|tech|develop/i,
    domain: "capterra.com",
    url: "https://www.capterra.com/",
    title: "Capterra software directory",
    kind: BacklinkKind.DIRECTORY,
    score: 76,
    contactHint: "Vendor listing",
    nicheFit: "Software directory",
    outreachAngle: "List your product/services for category visibility.",
  },
  {
    match: /it|software|web|tech|develop|code|app/i,
    domain: "dev.to",
    url: "https://dev.to/",
    title: "DEV Community — technical blogging",
    kind: BacklinkKind.GUEST_POST,
    score: 70,
    contactHint: "Publish as author (bio link)",
    nicheFit: "Developer audience guest content",
    outreachAngle: "Publish technical how-tos; link to relevant service pages in bio/CTA.",
  },
  {
    match: /it|software|web|tech|develop|startup|saas/i,
    domain: "hackernoon.com",
    url: "https://hackernoon.com/about/write",
    title: "HackerNoon — write for us",
    kind: BacklinkKind.GUEST_POST,
    score: 73,
    contactHint: "Contributor guidelines on /about/write",
    nicheFit: "Tech guest posting",
    outreachAngle: "Pitch an original engineering/business tech story.",
  },
  {
    match: /it|software|web|tech|develop|saas|startup/i,
    domain: "medium.com",
    url: "https://medium.com/",
    title: "Medium — niche publications",
    kind: BacklinkKind.GUEST_POST,
    score: 62,
    contactHint: "Join publications in your niche",
    nicheFit: "Thought leadership posts",
    outreachAngle: "Contribute to IT/business publications; use author bio link.",
  },
  {
    match: /it|software|web|tech|business|agency|saudi|gulf|mena/i,
    domain: "business.com",
    url: "https://www.business.com/contribute/",
    title: "Business.com contribute",
    kind: BacklinkKind.GUEST_POST,
    score: 68,
    contactHint: "Contribute / writer guidelines",
    nicheFit: "Business + services guest posts",
    outreachAngle: "Pitch practical SME tech guides tied to your services.",
  },
  {
    match: /it|software|web|tech|business|marketing|agency/i,
    domain: "entrepreneur.com",
    url: "https://www.entrepreneur.com/article/305864",
    title: "Entrepreneur — write for us",
    kind: BacklinkKind.GUEST_POST,
    score: 75,
    contactHint: "Contributor guidelines page",
    nicheFit: "Business authority guest post",
    outreachAngle: "Pitch founder/ops lessons relevant to digital services.",
  },
  {
    match: /it|software|web|tech|develop|saas/i,
    domain: "sitepoint.com",
    url: "https://www.sitepoint.com/write-for-us/",
    title: "SitePoint write for us",
    kind: BacklinkKind.GUEST_POST,
    score: 71,
    contactHint: "write-for-us page",
    nicheFit: "Web development audience",
    outreachAngle: "Pitch deep technical tutorials for web developers.",
  },
  {
    match: /it|software|web|tech|develop|css|frontend|javascript/i,
    domain: "css-tricks.com",
    url: "https://css-tricks.com/guest-posting/",
    title: "CSS-Tricks guest posting",
    kind: BacklinkKind.GUEST_POST,
    score: 74,
    contactHint: "Guest posting guidelines",
    nicheFit: "Frontend / web craft",
    outreachAngle: "Offer a unique frontend/UX article if that matches services.",
  },
  {
    match: /it|software|web|tech|seo|marketing|digital|agency/i,
    domain: "searchenginejournal.com",
    url: "https://www.searchenginejournal.com/write/",
    title: "Search Engine Journal — write",
    kind: BacklinkKind.GUEST_POST,
    score: 77,
    contactHint: "Write for SEJ guidelines",
    nicheFit: "SEO / digital marketing",
    outreachAngle: "Pitch data-backed SEO or content ops articles.",
  },
  {
    match: /it|software|web|tech|saas|startup|product/i,
    domain: "producthunt.com",
    url: "https://www.producthunt.com/",
    title: "Product Hunt",
    kind: BacklinkKind.MENTION,
    score: 66,
    contactHint: "Launch / maker profile",
    nicheFit: "Product launches & mentions",
    outreachAngle: "Launch a free tool or case study asset for community links.",
  },
  {
    match: /it|software|web|tech|develop|forum|community/i,
    domain: "indiehackers.com",
    url: "https://www.indiehackers.com/",
    title: "Indie Hackers community",
    kind: BacklinkKind.FORUM,
    score: 64,
    contactHint: "Profile + discussions",
    nicheFit: "Builder community mentions",
    outreachAngle: "Share build-in-public stories; link to useful resources.",
  },
  {
    match: /it|software|web|tech|business|saudi|gulf|uae|dubai|riyadh|mena|imple/i,
    domain: "arabianbusiness.com",
    url: "https://www.arabianbusiness.com/",
    title: "Arabian Business",
    kind: BacklinkKind.MENTION,
    score: 70,
    contactHint: "Newsroom / contribute tips",
    nicheFit: "MENA business media",
    outreachAngle: "Pitch regional tech/digital transformation angles.",
  },
  {
    match: /it|software|web|tech|saudi|gulf|uae|dubai|mena|imple/i,
    domain: "zawya.com",
    url: "https://www.zawya.com/",
    title: "Zawya — MENA business news",
    kind: BacklinkKind.MENTION,
    score: 69,
    contactHint: "Press / news tips",
    nicheFit: "MENA press mentions",
    outreachAngle: "Share newsworthy product or partnership announcements.",
  },
  {
    match: /it|software|web|tech|business|directory|agency/i,
    domain: "sortlist.com",
    url: "https://www.sortlist.com/",
    title: "Sortlist agency marketplace",
    kind: BacklinkKind.DIRECTORY,
    score: 67,
    contactHint: "Agency profile",
    nicheFit: "Agency discovery directory",
    outreachAngle: "Complete agency profile for local/service categories.",
  },
  {
    match: /it|software|web|tech|develop|host|cloud/i,
    domain: "alternativeto.net",
    url: "https://alternativeto.net/",
    title: "AlternativeTo",
    kind: BacklinkKind.DIRECTORY,
    score: 65,
    contactHint: "Add app listing",
    nicheFit: "Software alternatives directory",
    outreachAngle: "List your tool as an alternative in relevant categories.",
  },
  {
    match: /it|software|web|tech|saas|startup/i,
    domain: "betalist.com",
    url: "https://betalist.com/submit",
    title: "BetaList submit",
    kind: BacklinkKind.DIRECTORY,
    score: 60,
    contactHint: "Submit startup",
    nicheFit: "Startup directories",
    outreachAngle: "Submit product/startup page for early visibility links.",
  },
  // General business / local
  {
    match: /./,
    domain: "crunchbase.com",
    url: "https://www.crunchbase.com/",
    title: "Crunchbase company profile",
    kind: BacklinkKind.DIRECTORY,
    score: 72,
    contactHint: "Claim organization profile",
    nicheFit: "Company knowledge graph",
    outreachAngle: "Claim and complete company profile with website URL.",
  },
  {
    match: /./,
    domain: "linkedin.com",
    url: "https://www.linkedin.com/",
    title: "LinkedIn company page",
    kind: BacklinkKind.PARTNER,
    score: 58,
    contactHint: "Company page + articles",
    nicheFit: "Brand presence (nofollow often)",
    outreachAngle: "Publish LinkedIn articles; strengthen entity signals.",
  },
  {
    match: /./,
    domain: "google.com",
    url: "https://business.google.com/",
    title: "Google Business Profile",
    kind: BacklinkKind.DIRECTORY,
    score: 80,
    contactHint: "Business profile",
    nicheFit: "Local/entity citations",
    outreachAngle: "Claim GBP and keep NAP consistent with website.",
  },
];

export function seedBacklinkProspects(input: {
  nicheLabel: string;
  services: string[];
  coreTerms: string[];
  limit?: number;
}): BacklinkAgentItem[] {
  const hay = [input.nicheLabel, ...input.services, ...input.coreTerms].join(" ");
  const matched = SEEDS.filter((s) => s.match.test(hay));
  const picked = (matched.length >= 8 ? matched : SEEDS).slice(0, input.limit ?? 22);

  return picked.map((s) => ({
    domain: s.domain,
    url: s.url,
    title: s.title,
    kind: s.kind,
    score: s.score,
    nicheFit: `${s.nicheFit} · matched to “${input.nicheLabel}”`,
    outreachAngle: s.outreachAngle.replace(
      /your services/gi,
      input.services[0] || input.nicheLabel
    ),
    contactHint: s.contactHint,
  }));
}

/** Prefer the 1000+ easy-submit catalog when available. */
export function seedAllEasyBacklinks(input: {
  nicheLabel: string;
  services: string[];
  coreTerms: string[];
}): BacklinkAgentItem[] {
  // Imported dynamically in agent to avoid circular deps — see loadEasyBacklinkCatalog
  return seedBacklinkProspects({ ...input, limit: 40 });
}

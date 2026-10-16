import { BacklinkKind, DataKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateText } from "@/services/ai/provider";
import { deepCrawlSite, aggregateSiteKeywords } from "@/services/seo/crawl-site";
import { buildNicheProfile } from "@/services/seo/niche";
import { extractServices } from "@/services/articles/seo-pack";
import { searchBacklinkQueries } from "@/services/backlinks/search";
import { type BacklinkAgentItem } from "@/services/backlinks/seeds";
import {
  easyCatalogCount,
  loadEasyBacklinkCatalog,
} from "@/services/backlinks/easy-catalog";

export type { BacklinkAgentItem };

function parseJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown[];
  }
  const objStart = cleaned.indexOf("{");
  if (objStart >= 0) {
    const obj = JSON.parse(cleaned.slice(objStart)) as { prospects?: unknown[] };
    return obj.prospects || [];
  }
  return [];
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || url;
  }
}

function mapKind(raw: string): BacklinkKind {
  const k = (raw || "").toUpperCase().replace(/\s+/g, "_");
  if (k in BacklinkKind) return k as BacklinkKind;
  if (/guest/i.test(raw)) return BacklinkKind.GUEST_POST;
  if (/resource/i.test(raw)) return BacklinkKind.RESOURCE_PAGE;
  if (/director/i.test(raw)) return BacklinkKind.DIRECTORY;
  if (/partner|sponsor/i.test(raw)) return BacklinkKind.PARTNER;
  if (/forum|community|reddit/i.test(raw)) return BacklinkKind.FORUM;
  if (/mention|pr|news/i.test(raw)) return BacklinkKind.MENTION;
  return BacklinkKind.OTHER;
}

function buildQueries(niche: string, services: string[], domain: string): string[] {
  const svc = services[0] || niche;
  const brand = domain.replace(/^www\./, "").split(".")[0] || niche;
  return [
    `"write for us" ${svc}`,
    `${svc} guest post guidelines`,
    `${niche} resource page links`,
    `${svc} blog submit guest article`,
    `best ${niche} directories`,
    `${svc} "contribute" OR "guest blogging"`,
    `${niche} link roundup`,
    `${brand} ${svc} industry partners`,
  ];
}

/**
 * AI backlink agent:
 * 1) Learn site niche/services
 * 2) Search for guest-post / resource / directory opportunities
 * 3) AI scores + outreach angles
 * 4) Persist list for the website
 */
export async function runBacklinkAgent(websiteId: string) {
  const website = await prisma.website.findUniqueOrThrow({
    where: { id: websiteId },
    include: { categories: true, settings: true },
  });

  const pages = await deepCrawlSite(website.domain, 10);
  const siteKeywords = aggregateSiteKeywords(pages);
  const niche = buildNicheProfile({
    domain: website.domain,
    pages,
    categories: website.categories,
    siteKeywords,
  });
  const services = extractServices({
    categories: website.categories.map((c) => c.name),
    headings: pages.flatMap((p) => p.headings).slice(0, 60),
    titles: pages.map((p) => p.title),
    urls: pages.map((p) => p.url),
    nicheCore: niche.coreTerms,
  });

  const ownHost = hostOf(
    website.domain.startsWith("http") ? website.domain : `https://${website.domain}`
  );

  const queries = buildQueries(niche.label, services, ownHost);
  const { sources, hasLive, queriesRun } = await searchBacklinkQueries(queries);

  // Drop own domain + junk
  const filtered = sources.filter((s) => {
    const h = hostOf(s.url);
    if (!h || h === ownHost) return false;
    if (/facebook\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|instagram\.com/i.test(h)) {
      return false;
    }
    return true;
  });

  const { text, provider, offline } = await generateText({
    websiteId,
    provider: website.settings?.aiProvider,
    kind: "backlinks",
    messages: [
      {
        role: "system",
        content: `You are a white-hat SEO backlink research agent.
Return ONLY a JSON array of prospects (max 25). Each item:
{
  "domain": string,
  "url": string,
  "title": string,
  "kind": "GUEST_POST"|"RESOURCE_PAGE"|"DIRECTORY"|"PARTNER"|"MENTION"|"FORUM"|"OTHER",
  "score": number 0-100,
  "nicheFit": string,
  "outreachAngle": string,
  "contactHint": string
}
Rules:
- Return 15–25 real, relevant websites (not a single Google search link).
- Only suggest sites relevant to the given niche/services.
- Prefer real URLs from the search results provided.
- You MUST also include well-known legitimate directories/guest-post sites for that niche.
- No PBN, link farms, or black-hat tactics.
- Outreach angles must be ethical (guest post pitch, resource addition, partnership).
- Do not invent fake contact emails; use hints like "contact page" or "editor@" pattern only if typical.`,
      },
      {
        role: "user",
        content: `Find backlink opportunities for:
Domain: ${website.domain}
Niche: ${niche.label}
Services: ${services.join(", ") || "n/a"}
Core terms: ${niche.coreTerms.slice(0, 12).join(", ")}
Live search results (${filtered.length}):
${JSON.stringify(filtered.slice(0, 40))}
Queries used: ${JSON.stringify(queriesRun)}
hasLiveSearch: ${hasLive}
Return a full list of websites even if live search is empty.`,
      },
    ],
  });

  // 1000+ easy-submit catalog (directories, profiles, free PR)
  const easyAll = loadEasyBacklinkCatalog({
    nicheLabel: niche.label,
    services: [...services, ...niche.coreTerms],
    preferEasy: true,
  });

  let aiItems: BacklinkAgentItem[] = [];
  try {
    const raw = parseJsonArray(text);
    aiItems = raw
      .map((row) => {
        const r = row as Record<string, unknown>;
        const url = String(r.url || "").trim();
        if (!url.startsWith("http")) return null;
        if (/google\.com\/search|bing\.com\/search|duckduckgo\.com\/\?q=/i.test(url)) {
          return null;
        }
        const domain = String(r.domain || hostOf(url));
        if (hostOf(url) === ownHost || domain === ownHost) return null;
        return {
          domain,
          url,
          title: String(r.title || domain).slice(0, 200),
          kind: mapKind(String(r.kind || "OTHER")),
          score: Math.max(0, Math.min(100, Number(r.score) || 40)),
          nicheFit: String(r.nicheFit || niche.label).slice(0, 400),
          outreachAngle: String(
            r.outreachAngle || "Introduce relevant content for their audience."
          ).slice(0, 500),
          contactHint: String(r.contactHint || "Check site contact / about page").slice(
            0,
            200
          ),
        } satisfies BacklinkAgentItem;
      })
      .filter(Boolean) as BacklinkAgentItem[];
  } catch {
    aiItems = filtered.slice(0, 20).map((s, i) => ({
      domain: hostOf(s.url),
      url: s.url,
      title: s.title,
      kind: /write for us|guest/i.test(s.title + s.snippet)
        ? BacklinkKind.GUEST_POST
        : /directory|list of/i.test(s.title + s.snippet)
          ? BacklinkKind.DIRECTORY
          : BacklinkKind.RESOURCE_PAGE,
      score: Math.max(30, 70 - i * 2),
      nicheFit: `Possibly related to ${niche.label}`,
      outreachAngle: `Pitch a helpful article about ${services[0] || niche.label}`,
      contactHint: "Find contact or guest post guidelines on site",
    }));
  }

  const byUrl = new Map<string, BacklinkAgentItem>();
  for (const item of [...easyAll, ...aiItems]) {
    const key = item.url.toLowerCase();
    if (!byUrl.has(key)) byUrl.set(key, item);
  }
  const items = [...byUrl.values()].sort((a, b) => b.score - a.score);

  await prisma.backlinkProspect.deleteMany({
    where: {
      websiteId,
      OR: [
        { domain: "example-directories" },
        { url: { contains: "google.com/search" } },
      ],
    },
  });

  const evidence = JSON.stringify({
    niche: niche.label,
    services,
    provider,
    offline,
    hasLive,
    catalogSize: easyCatalogCount(),
    kind: DataKind.RECOMMENDATION,
  });

  const existing = await prisma.backlinkProspect.findMany({
    where: { websiteId },
    select: { id: true, url: true },
  });
  const existingByUrl = new Map(existing.map((e) => [e.url.toLowerCase(), e.id]));

  let created = 0;
  const updated = 0;
  const source = hasLive ? "search+ai+catalog" : "easy_catalog";
  const toCreate: {
    websiteId: string;
    domain: string;
    url: string;
    title: string;
    kind: BacklinkKind;
    score: number;
    nicheFit: string;
    outreachAngle: string;
    contactHint: string;
    evidenceJson: string;
    source: string;
  }[] = [];

  for (const item of items) {
    const key = item.url.toLowerCase();
    if (existingByUrl.has(key)) continue;
    toCreate.push({
      websiteId,
      domain: item.domain,
      url: item.url,
      title: item.title,
      kind: item.kind,
      score: item.score,
      nicheFit: item.nicheFit,
      outreachAngle: item.outreachAngle,
      contactHint: item.contactHint,
      evidenceJson: evidence,
      source,
    });
  }

  // Batch insert new rows
  const chunk = 100;
  for (let i = 0; i < toCreate.length; i += chunk) {
    const batch = toCreate.slice(i, i + chunk);
    const res = await prisma.backlinkProspect.createMany({
      data: batch,
      skipDuplicates: true,
    });
    created += res.count;
  }

  const total = await prisma.backlinkProspect.count({
    where: { websiteId, status: { not: "SKIPPED" } },
  });
  const list = await prisma.backlinkProspect.findMany({
    where: { websiteId, status: { not: "SKIPPED" } },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return {
    niche: niche.label,
    services,
    queriesRun,
    hasLiveSearch: hasLive,
    provider,
    offline,
    created,
    updated,
    total,
    catalogSize: easyCatalogCount(),
    prospects: list,
    disclaimer:
      `${total}+ opportunity sites loaded (easy-submit catalog). White-hat only — verify before submitting. Not a ranking guarantee.`,
  };
}

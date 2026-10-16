import { BacklinkKind } from "@prisma/client";
import type { BacklinkAgentItem } from "@/services/backlinks/seeds";
import catalog from "@/data/easy-backlink-sites.json";

type CatalogSite = {
  domain: string;
  url: string;
  title: string;
  kind: string;
  score: number;
  ease: string;
  tags: string[];
  contactHint: string;
  outreachAngle: string;
};

const KIND_MAP: Record<string, BacklinkKind> = {
  GUEST_POST: BacklinkKind.GUEST_POST,
  RESOURCE_PAGE: BacklinkKind.RESOURCE_PAGE,
  DIRECTORY: BacklinkKind.DIRECTORY,
  PARTNER: BacklinkKind.PARTNER,
  MENTION: BacklinkKind.MENTION,
  FORUM: BacklinkKind.FORUM,
  OTHER: BacklinkKind.OTHER,
};

function mapKind(raw: string): BacklinkKind {
  return KIND_MAP[raw] || BacklinkKind.DIRECTORY;
}

/** Full 1000+ easy-submit catalog (white-hat directories, profiles, PR). */
export function loadEasyBacklinkCatalog(input?: {
  nicheLabel?: string;
  services?: string[];
  preferEasy?: boolean;
  limit?: number;
}): BacklinkAgentItem[] {
  const sites = (catalog as { sites: CatalogSite[] }).sites || [];
  const hay = [input?.nicheLabel || "", ...(input?.services || [])]
    .join(" ")
    .toLowerCase();

  const scored = sites.map((s) => {
    let boost = 0;
    if (hay) {
      for (const t of s.tags) {
        if (hay.includes(t) || t === "easy" || t === "general") {
          if (hay.includes(t)) boost += 4;
        }
      }
      if (/saudi|mena|gulf|arab|imple|riyadh|dubai/i.test(hay)) {
        if (s.tags.some((t) => /mena|saudi|local|business/.test(t))) boost += 6;
      }
      if (/it|software|web|tech|saas|digital|cloud|develop/i.test(hay)) {
        if (s.tags.some((t) => /it|software|saas|tech|web/.test(t))) boost += 5;
      }
    }
    if (input?.preferEasy !== false && s.ease === "easy") boost += 2;
    return {
      domain: s.domain,
      url: s.url,
      title: s.title,
      kind: mapKind(s.kind),
      score: Math.min(100, s.score + boost),
      nicheFit: `Easy submit · ${s.tags.slice(0, 3).join(", ")}`,
      outreachAngle: s.outreachAngle,
      contactHint: s.contactHint,
    } satisfies BacklinkAgentItem;
  });

  scored.sort((a, b) => b.score - a.score);
  const limit = input?.limit ?? scored.length;
  return scored.slice(0, limit);
}

export function easyCatalogCount(): number {
  return (catalog as { count?: number; sites: CatalogSite[] }).count ||
    (catalog as { sites: CatalogSite[] }).sites?.length ||
    0;
}

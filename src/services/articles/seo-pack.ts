/**
 * SEO metadata + on-page keyword highlighting for generated blogs.
 */

export type SeoPack = {
  focusKeyword: string;
  secondaryKeywords: string[];
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  slugHint: string;
  searchIntent: string;
};

function cleanKw(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function uniqueKeywords(list: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const k = cleanKw(raw).toLowerCase();
    if (!k || k.length < 3 || seen.has(k)) continue;
    seen.add(k);
    out.push(cleanKw(raw));
    if (out.length >= max) break;
  }
  return out;
}

function normalizeIntent(raw?: string | null): string {
  const t = (raw || "informational").toLowerCase();
  if (t.includes("transact") || t.includes("buy") || t.includes("hire")) {
    return "transactional";
  }
  if (t.includes("commerc") || t.includes("service") || t.includes("compar")) {
    return "commercial";
  }
  if (t.includes("navig")) return "navigational";
  return "informational";
}

/** Build / repair SEO title, description, and keyword set by search intent. */
export function buildSeoPack(input: {
  title: string;
  focusKeyword: string;
  secondaryKeywords?: string[];
  seoTitle?: string | null;
  metaDescription?: string | null;
  nicheLabel?: string;
  services?: string[];
  domain?: string;
  searchIntent?: string | null;
}): SeoPack {
  const focus = cleanKw(input.focusKeyword) || cleanKw(input.title);
  const intent = normalizeIntent(input.searchIntent);
  const brand = (input.domain || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    ?.split(".")[0];
  const svc = (input.services || []).filter(Boolean)[0] || input.nicheLabel || "";

  const secondary = uniqueKeywords(
    [
      ...(input.secondaryKeywords || []),
      ...(input.services || []).slice(0, 4),
      input.nicheLabel || "",
    ].filter(Boolean),
    8
  ).filter((k) => k.toLowerCase() !== focus.toLowerCase());

  let seoTitle = cleanKw(input.seoTitle || "");
  if (!seoTitle || seoTitle.length < 25) {
    if (intent === "transactional") {
      seoTitle = `${focus} Services${svc ? ` | ${svc}` : ""}${brand ? ` — ${brand}` : ""}`;
    } else if (intent === "commercial") {
      seoTitle = `Best ${focus} Guide${brand ? ` | ${brand}` : ""}`;
    } else {
      seoTitle = `${focus}: Complete Guide${brand ? ` | ${brand}` : ""}`;
    }
  }
  if (!seoTitle.toLowerCase().includes(focus.toLowerCase().slice(0, 24))) {
    seoTitle = `${focus} — ${seoTitle}`;
  }
  seoTitle = seoTitle.slice(0, 60).replace(/\s+[—-|]\s*$/, "").trim();
  if (seoTitle.length > 60) seoTitle = seoTitle.slice(0, 57).trim() + "…";

  let meta = cleanKw(input.metaDescription || "");
  if (!meta || meta.length < 80) {
    if (intent === "transactional") {
      meta = `Get expert ${focus}${svc ? ` for ${svc}` : ""}. Clear process, practical results${
        brand ? ` from ${brand}` : ""
      }. Contact us to start today.`;
    } else if (intent === "commercial") {
      meta = `Compare options for ${focus}. See what matters, common pitfalls, and how ${
        svc || input.nicheLabel || "experts"
      } help you choose with confidence.`;
    } else {
      meta = `Learn ${focus} step by step${svc ? ` — related to ${svc}` : ""}. Tips, examples, and FAQs for ${
        input.nicheLabel || "your business"
      }.`;
    }
  }
  if (!meta.toLowerCase().includes(focus.toLowerCase().slice(0, 18))) {
    meta = `${focus}: ${meta}`;
  }
  meta = meta.replace(/\s+/g, " ").trim();
  if (meta.length > 155) meta = meta.slice(0, 152).trim() + "…";
  if (meta.length < 100) {
    meta = `${meta} Updated guide with actionable takeaways.`.slice(0, 155);
  }

  const tags = uniqueKeywords([focus, ...secondary, intent], 10);
  const slugHint = focus
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

  return {
    focusKeyword: focus,
    secondaryKeywords: secondary,
    seoTitle,
    metaDescription: meta,
    tags,
    slugHint,
    searchIntent: intent,
  };
}

/**
 * Wrap keyword occurrences in HTML with <mark class="seo-kw">…</mark>
 * Skips attributes/tags; limits highlights per keyword.
 */
export function highlightKeywordsInHtml(
  html: string,
  keywords: string[],
  opts?: { maxPerKeyword?: number }
): string {
  const maxPer = opts?.maxPerKeyword ?? 4;
  const sorted = uniqueKeywords(keywords, 12).sort((a, b) => b.length - a.length);
  if (!sorted.length || !html) return html;

  let result = html;
  for (const kw of sorted) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    let count = 0;
    let out = "";
    let last = 0;
    // Walk outside of tags
    const tagRe = /<[^>]+>/g;
    let m: RegExpExecArray | null;
    const segments: { start: number; end: number; isTag: boolean }[] = [];
    while ((m = tagRe.exec(result)) !== null) {
      if (m.index > last) {
        segments.push({ start: last, end: m.index, isTag: false });
      }
      segments.push({ start: m.index, end: m.index + m[0].length, isTag: true });
      last = m.index + m[0].length;
    }
    if (last < result.length) {
      segments.push({ start: last, end: result.length, isTag: false });
    }

    for (const seg of segments) {
      const chunk = result.slice(seg.start, seg.end);
      if (seg.isTag) {
        out += chunk;
        continue;
      }
      // Skip already highlighted
      if (/seo-kw/i.test(chunk)) {
        out += chunk;
        continue;
      }
      out += chunk.replace(re, (match) => {
        if (count >= maxPer) return match;
        // Avoid nesting inside existing mark/strong near match — simple skip if already marked
        count += 1;
        return `<mark class="seo-kw">${match}</mark>`;
      });
    }
    result = out;
  }
  return result;
}

/** Bold focus keyword once in opening paragraph of markdown if missing. */
export function ensureKeywordInMarkdown(md: string, focusKeyword: string): string {
  const focus = cleanKw(focusKeyword);
  if (!focus || !md) return md;
  if (md.toLowerCase().includes(focus.toLowerCase())) return md;

  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || line.startsWith("#") || line.startsWith("-") || line.startsWith("*")) {
      continue;
    }
    lines[i] = `**${focus}** — ${line}`;
    break;
  }
  return lines.join("\n");
}

/** Extract service-like labels from crawl pages + categories. */
export function extractServices(input: {
  categories: string[];
  headings: string[];
  titles: string[];
  urls: string[];
  nicheCore: string[];
}): string[] {
  const fromCat = input.categories.map(cleanKw).filter(Boolean);
  const servicey =
    /\b(service|services|solution|solutions|consulting|development|design|support|management|marketing|hosting|security|cloud|software|app|agency|repair|installation|maintenance)\b/i;

  const fromHeadings = [...input.headings, ...input.titles]
    .map(cleanKw)
    .filter((h) => h.length > 3 && h.length < 60 && servicey.test(h))
    .slice(0, 12);

  const fromUrls = input.urls
    .map((u) => {
      try {
        const path = new URL(u).pathname;
        if (!/service|solution|product|offer|what-we/i.test(path)) return "";
        return path
          .split("/")
          .filter(Boolean)
          .pop()
          ?.replace(/[-_]/g, " ") || "";
      } catch {
        return "";
      }
    })
    .map(cleanKw)
    .filter((s) => s.length > 3);

  return uniqueKeywords(
    [...fromCat, ...fromHeadings, ...fromUrls, ...input.nicheCore.filter((c) => c.includes(" "))],
    12
  );
}

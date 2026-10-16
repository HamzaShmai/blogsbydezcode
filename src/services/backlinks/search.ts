import * as cheerio from "cheerio";
import { researchTopic, type ResearchSource } from "@/services/research/search";

/** Free DuckDuckGo HTML search (no API key). Results are recommendations. */
async function duckDuckGoSearch(query: string, limit = 8): Promise<ResearchSource[]> {
  try {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", query);
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "PulseRankBot/1.0 (+backlink-research)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const out: ResearchSource[] = [];
    $(".result, .results_links, .web-result").each((_, el) => {
      if (out.length >= limit) return;
      const a = $(el).find("a.result__a, a.result-link, h2 a").first();
      let href = a.attr("href") || "";
      const title = a.text().trim();
      const snippet = $(el).find(".result__snippet, .result-snippet").text().trim();
      // DDG sometimes wraps redirects
      if (href.includes("uddg=")) {
        try {
          const u = new URL(href, "https://duckduckgo.com");
          href = decodeURIComponent(u.searchParams.get("uddg") || href);
        } catch {
          /* keep */
        }
      }
      if (!href.startsWith("http") || !title) return;
      out.push({
        title,
        url: href.split("&")[0]!,
        snippet: snippet.slice(0, 280),
      });
    });
    return out;
  } catch {
    return [];
  }
}

export async function searchBacklinkQueries(
  queries: string[]
): Promise<{ sources: ResearchSource[]; hasLive: boolean; queriesRun: string[] }> {
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  let hasLive = false;
  const queriesRun: string[] = [];

  for (const q of queries.slice(0, 8)) {
    queriesRun.push(q);
    // Prefer configured providers, then free DDG
    const paid = await researchTopic(q);
    if (paid.hasLiveResearch && paid.sources.length) {
      hasLive = true;
      for (const s of paid.sources) {
        const key = s.url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push(s);
      }
      continue;
    }
    const ddg = await duckDuckGoSearch(q, 6);
    if (ddg.length) {
      hasLive = true;
      for (const s of ddg) {
        const key = s.url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push(s);
      }
    }
  }

  return { sources, hasLive, queriesRun };
}

export type ResearchSource = {
  title: string;
  url: string;
  snippet: string;
};

export async function researchTopic(query: string): Promise<{
  sources: ResearchSource[];
  hasLiveResearch: boolean;
  summary: string;
}> {
  if (process.env.TAVILY_API_KEY) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 5,
        include_answer: true,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        answer?: string;
        results?: { title: string; url: string; content: string }[];
      };
      const sources =
        data.results?.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content?.slice(0, 280) ?? "",
        })) ?? [];
      return {
        sources,
        hasLiveResearch: true,
        summary: data.answer || `Research summary for ${query}`,
      };
    }
  }

  if (process.env.SERPAPI_API_KEY) {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", process.env.SERPAPI_API_KEY);
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as {
        organic_results?: { title: string; link: string; snippet: string }[];
      };
      const sources =
        data.organic_results?.slice(0, 5).map((r) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet ?? "",
        })) ?? [];
      return {
        sources,
        hasLiveResearch: true,
        summary: `Top search results for ${query}`,
      };
    }
  }

  // Graceful degrade — never invent sources
  return {
    sources: [],
    hasLiveResearch: false,
    summary: `No live research provider configured for "${query}". Article will proceed without fabricated citations.`,
  };
}

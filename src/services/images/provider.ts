import { recordUsage, withinBudget } from "@/services/ai/provider";

function placeholderSvg(title: string, keyword?: string): string {
  const safe = (keyword || title).replace(/[<>&]/g, "").slice(0, 60);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6d28d9"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    fill="#f5f3ff" font-family="Georgia, serif" font-size="40">${safe}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Simple PNG-ish fallback via SVG won't upload to WP — use remote placeholder when needed. */
function remotePlaceholder(keyword: string): string {
  const q = encodeURIComponent(keyword.slice(0, 40) || "blog");
  return `https://placehold.co/1200x630/6d28d9/f5f3ff/png?text=${q}`;
}

export async function generateFeaturedImage(input: {
  websiteId: string;
  title: string;
  focusKeyword?: string;
  provider?: string;
}): Promise<{ url: string; alt: string; provider: string }> {
  if (!(await withinBudget(input.websiteId))) {
    throw new Error("Website usage budget exceeded");
  }

  const kw = (input.focusKeyword || input.title).trim();
  const alt = `${kw} — illustrated featured image for blog post: ${input.title}`.slice(
    0,
    180
  );

  if (process.env.OPENAI_API_KEY && (input.provider === "openai" || !input.provider || input.provider === "grok")) {
    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `Professional editorial blog header photo for topic "${input.title}" about ${kw}. Clean, modern, no text overlays, no logos, photorealistic or high-quality illustration.`,
          size: "1792x1024",
          n: 1,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { data: { url: string }[] };
        const url = data.data[0]?.url;
        if (url) {
          await recordUsage(input.websiteId, "openai", "image", 1, 0.04);
          return { url, alt, provider: "openai" };
        }
      }
    } catch {
      // fall through
    }
  }

  // Prefer remote PNG so WordPress can download/upload it
  const url = remotePlaceholder(kw);
  await recordUsage(input.websiteId, "placeholder", "image", 1, 0, {
    note: "PNG placeholder — set OPENAI_API_KEY for AI images",
    svgFallback: placeholderSvg(input.title, kw).slice(0, 40),
  });
  return { url, alt, provider: "placeholder" };
}

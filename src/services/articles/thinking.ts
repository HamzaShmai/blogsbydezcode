import { generateText } from "@/services/ai/provider";
import type { BlogStyleProfile } from "@/services/seo/blog-style";
import type { ResearchSource } from "@/services/research/search";

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  }
  return JSON.parse(cleaned) as Record<string, unknown>;
}

/**
 * Multi-step thinking: niche/services brief → outline → SEO blog draft
 */
export async function thinkThenWriteArticle(input: {
  websiteId: string;
  provider?: string;
  topicTitle: string;
  keyword: string;
  searchIntent?: string | null;
  categories: string[];
  nicheLabel: string;
  nicheCore: string[];
  services: string[];
  researchSummary: string;
  hasLiveResearch: boolean;
  sources: ResearchSource[];
  internalLinks: { title: string; url: string }[];
  style: BlogStyleProfile;
  domain: string;
}) {
  const nicheBlock = `Site niche: ${input.nicheLabel}
Core topics: ${input.nicheCore.slice(0, 10).join(", ")}
Services / offerings: ${input.services.slice(0, 10).join(", ") || input.categories.join(", ") || "general"}
Stay strictly on this niche — do NOT write about unrelated industries.`;

  const { text: thinkText, provider: p1, offline: o1 } = await generateText({
    websiteId: input.websiteId,
    provider: input.provider,
    kind: "think",
    messages: [
      {
        role: "system",
        content:
          "You are a senior SEO content strategist for a specific business website. Think carefully. Return ONLY JSON with keys: audience, searchIntent, uniqueAngle, objections, keyPoints (string[]), mustCover (string[]), avoid (string[]), tone, serviceAngle (how this topic connects to their real services), secondaryKeywords (string[5-8] related to niche+services). No ranking guarantees. Do not invent statistics.",
      },
      {
        role: "user",
        content: `Plan a blog for ${input.domain}.
${nicheBlock}
Topic: ${input.topicTitle}
Primary / focus keyword: ${input.keyword}
Hint intent: ${input.searchIntent ?? "informational"}
Categories: ${input.categories.join(", ")}
Site voice notes: ${input.style.toneNotes}
Existing title patterns: ${JSON.stringify(input.style.titlePatterns)}
Research available: ${input.hasLiveResearch}
Research: ${input.researchSummary}
Sources (do not invent beyond these): ${JSON.stringify(input.sources)}
Target length ~${input.style.avgWordCount} words.
Secondary keywords must be related to this site's niche and services only.`,
      },
    ],
  });

  let brief: Record<string, unknown> = {};
  try {
    brief = parseJsonObject(thinkText);
  } catch {
    brief = {
      audience: `People looking for ${input.services[0] || input.nicheLabel} help`,
      uniqueAngle: `${input.topicTitle} for ${input.nicheLabel}`,
      keyPoints: [input.keyword, ...input.services.slice(0, 3)],
      serviceAngle: input.services[0] || input.nicheLabel,
      secondaryKeywords: input.services.slice(0, 5),
      tone: input.style.toneNotes,
    };
  }

  const { text: outlineText, offline: o2 } = await generateText({
    websiteId: input.websiteId,
    provider: input.provider,
    kind: "outline",
    messages: [
      {
        role: "system",
        content:
          "Build a detailed SEO outline for this business. Return ONLY JSON: { outline: string[], faqQuestions: string[], internalLinkPlan: {anchor:string,url:string}[], keywordPlacement: {intro:boolean,h2s:string[],conclusion:boolean} }. Prefer the site's heading style. Outline must mention services where natural.",
      },
      {
        role: "user",
        content: `Focus keyword: ${input.keyword}
${nicheBlock}
Strategy brief: ${JSON.stringify(brief)}
Heading style: ${input.style.headingStyle}
Use FAQ: ${input.style.usesFaq}
Use lists: ${input.style.usesLists}
Internal link targets: ${JSON.stringify(input.internalLinks)}
Voice samples from site (imitate, do not copy): ${JSON.stringify(input.style.voiceSamples)}`,
      },
    ],
  });

  let outlinePayload: Record<string, unknown> = {};
  try {
    outlinePayload = parseJsonObject(outlineText);
  } catch {
    outlinePayload = {
      outline: [
        `Introduction to ${input.keyword}`,
        `How ${input.services[0] || input.nicheLabel} helps`,
        "Best practices",
        "FAQ",
        "Conclusion",
      ],
      faqQuestions: [`What is ${input.keyword}?`],
      internalLinkPlan: input.internalLinks.slice(0, 3).map((l) => ({
        anchor: l.title,
        url: l.url,
      })),
    };
  }

  const { text: draftText, provider: p3, offline: o3 } = await generateText({
    websiteId: input.websiteId,
    provider: input.provider,
    kind: "article",
    messages: [
      {
        role: "system",
        content: `You are an expert SEO blog writer for a real business website.
Write a DETAILED, useful article (not a thin summary).
Return ONLY JSON with keys:
- title (H1, include focus keyword naturally, match search intent)
- seoTitle (50–60 chars, focus keyword near the start, no keyword stuffing)
- metaDescription (145–155 chars, focus keyword + benefit + soft CTA; match search intent)
- searchIntent ("informational"|"commercial"|"transactional"|"navigational")
- focusKeyword (string)
- secondaryKeywords (string[])
- tags (string[] SEO keywords)
- slug (kebab-case)
- outline (string[])
- contentMarkdown (full markdown article)
- faqs ({q,a}[] at least 3)
- citations ({title,url}[])
contentMarkdown rules:
- Aim for ${Math.max(1200, input.style.avgWordCount || 1200)}+ words of real substance
- Intro paragraph must include focus keyword in first 100 words (bold once)
- Use H2/H3 structure; cover services/niche angles
- Insert 2–5 INTERNAL links inline as markdown [anchor](url) using provided targets (not only a related list at the end)
- Include lists, practical steps, and a short conclusion CTA
- Secondary keywords appear naturally 2–4 times
Other rules:
- Stay on site niche/services only
- Never invent citations — only provided sources
- Never claim guaranteed rankings`,
      },
      {
        role: "user",
        content: `Write the full SEO article for ${input.domain}.
${nicheBlock}
Focus keyword: ${input.keyword}
Search intent hint: ${input.searchIntent ?? "informational"}
Strategy: ${JSON.stringify(brief)}
Outline: ${JSON.stringify(outlinePayload)}
HTML/design hints: ${JSON.stringify(input.style.htmlHints)}
Target words: ${Math.max(1200, input.style.avgWordCount || 1200)}
Sources allowed: ${JSON.stringify(input.sources)}
Internal links to weave INTO the article body: ${JSON.stringify(input.internalLinks)}
Sample titles on site: ${JSON.stringify(input.style.titlePatterns)}
seoTitle + metaDescription MUST match the search intent and mention a real service when possible.`,
      },
    ],
  });

  let article: Record<string, unknown>;
  try {
    article = parseJsonObject(draftText);
  } catch {
    article = {
      title: input.topicTitle,
      focusKeyword: input.keyword,
      secondaryKeywords: (brief.secondaryKeywords as string[]) || input.services.slice(0, 5),
      contentMarkdown: draftText,
      outline: outlinePayload.outline,
    };
  }

  if (!article.focusKeyword) article.focusKeyword = input.keyword;
  if (!Array.isArray(article.secondaryKeywords)) {
    article.secondaryKeywords =
      (brief.secondaryKeywords as string[]) || input.services.slice(0, 5);
  }

  return {
    article,
    brief,
    outline: outlinePayload,
    provider: p3 || p1,
    offline: o1 || o2 || o3,
  };
}

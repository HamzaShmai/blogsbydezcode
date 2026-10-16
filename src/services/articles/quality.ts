import { prisma } from "@/lib/db";
import { contentHash } from "@/lib/crypto";

export type QualityResult = {
  score: number;
  passed: boolean;
  issues: string[];
  duplicateOfId?: string;
};

export async function runQualityChecks(input: {
  websiteId: string;
  articleId?: string;
  title: string;
  contentMarkdown: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  slug: string;
  minThreshold: number;
}): Promise<QualityResult> {
  const issues: string[] = [];
  let score = 1;
  const body = input.contentMarkdown.toLowerCase();
  const focus = (input.focusKeyword || "").toLowerCase().trim();

  if (input.title.trim().length < 20) {
    issues.push("Title too short");
    score -= 0.15;
  }
  if (input.contentMarkdown.trim().length < 600) {
    issues.push("Body too short (< 600 chars)");
    score -= 0.25;
  }
  if (!/^#\s+/m.test(input.contentMarkdown) && !/^##\s+/m.test(input.contentMarkdown)) {
    issues.push("Missing headings");
    score -= 0.1;
  }
  if (!input.seoTitle) {
    issues.push("Missing SEO title");
    score -= 0.1;
  } else if (focus && !input.seoTitle.toLowerCase().includes(focus.slice(0, 24))) {
    issues.push("SEO title missing focus keyword");
    score -= 0.08;
  }
  if (!input.metaDescription || input.metaDescription.length < 50) {
    issues.push("Meta description missing or short");
    score -= 0.1;
  } else if (focus && !input.metaDescription.toLowerCase().includes(focus.slice(0, 20))) {
    issues.push("Meta description missing focus keyword");
    score -= 0.08;
  }
  if (focus && !body.includes(focus)) {
    issues.push("Body missing focus keyword");
    score -= 0.12;
  }
  if (!input.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    issues.push("Invalid URL slug");
    score -= 0.1;
  }
  if (/lorem ipsum/i.test(input.contentMarkdown)) {
    issues.push("Placeholder lorem ipsum detected");
    score -= 0.3;
  }

  const hash = contentHash(input.title, input.contentMarkdown);
  const duplicate = await prisma.article.findFirst({
    where: {
      websiteId: input.websiteId,
      contentHash: hash,
      ...(input.articleId ? { id: { not: input.articleId } } : {}),
    },
  });

  if (duplicate) {
    issues.push(`Duplicate of article ${duplicate.id}`);
    score -= 0.5;
  }

  score = Math.max(0, Math.min(1, score));
  return {
    score,
    passed: score >= input.minThreshold && !duplicate,
    issues,
    duplicateOfId: duplicate?.id,
  };
}

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    article: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { runQualityChecks } from "@/services/articles/quality";
import { prisma } from "@/lib/db";

describe("runQualityChecks", () => {
  beforeEach(() => {
    vi.mocked(prisma.article.findFirst).mockResolvedValue(null);
  });

  it("passes a solid article", async () => {
    const result = await runQualityChecks({
      websiteId: "w1",
      title: "A complete guide to technical SEO audits",
      contentMarkdown: `# Heading\n\n${"Paragraph content. ".repeat(40)}\n\n## FAQ\nDetails`,
      seoTitle: "Technical SEO audits guide",
      metaDescription: "Learn how to run technical SEO audits with a practical checklist.",
      slug: "technical-seo-audits-guide",
      minThreshold: 0.7,
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  it("flags duplicates", async () => {
    vi.mocked(prisma.article.findFirst).mockResolvedValue({ id: "dup" } as never);
    const result = await runQualityChecks({
      websiteId: "w1",
      title: "A complete guide to technical SEO audits",
      contentMarkdown: `# Heading\n\n${"Paragraph content. ".repeat(40)}`,
      seoTitle: "Technical SEO audits guide",
      metaDescription: "Learn how to run technical SEO audits with a practical checklist.",
      slug: "technical-seo-audits-guide",
      minThreshold: 0.7,
    });
    expect(result.passed).toBe(false);
    expect(result.duplicateOfId).toBe("dup");
  });
});

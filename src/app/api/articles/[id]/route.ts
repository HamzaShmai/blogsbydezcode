import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canAccessWebsite, canWriteWebsite } from "@/lib/rbac";
import { contentHash } from "@/lib/crypto";
import { markdownToHtml } from "@/services/articles/html";
import { highlightKeywordsInHtml } from "@/services/articles/seo-pack";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" } },
      assets: true,
      researchBrief: true,
      outline: true,
      internalLinks: true,
      publications: { orderBy: { createdAt: "desc" } },
      website: {
        select: {
          id: true,
          name: true,
          domain: true,
          cmsType: true,
          organizationId: true,
        },
      },
      category: true,
      topic: true,
    },
  });
  if (!article) return jsonError("Not found", 404);
  if (!(await canAccessWebsite(session!.user.id, article.websiteId))) {
    return jsonError("Forbidden", 403);
  }
  return jsonOk(article);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) return jsonError("Not found", 404);
  if (!(await canWriteWebsite(session!.user.id, existing.websiteId))) {
    return jsonError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    title?: string;
    contentMarkdown?: string;
    contentHtml?: string;
    seoTitle?: string;
    metaDescription?: string;
    slug?: string;
    tags?: string[];
    featuredImageAlt?: string;
    categoryId?: string | null;
  };

  const title = body.title ?? existing.title;
  const md = body.contentMarkdown ?? existing.contentMarkdown;
  const tags = body.tags ?? existing.tags;
  let contentHtml = body.contentHtml;
  if (body.contentMarkdown != null || body.tags != null) {
    contentHtml = highlightKeywordsInHtml(markdownToHtml(md), tags);
  } else {
    contentHtml = body.contentHtml ?? existing.contentHtml;
  }

  const latestVersion = await prisma.articleVersion.findFirst({
    where: { articleId: id },
    orderBy: { version: "desc" },
  });

  const article = await prisma.article.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      contentMarkdown: body.contentMarkdown,
      contentHtml,
      seoTitle: body.seoTitle,
      metaDescription: body.metaDescription,
      tags: body.tags,
      featuredImageAlt: body.featuredImageAlt,
      categoryId: body.categoryId === null ? null : body.categoryId,
      contentHash: contentHash(title, md),
      manuallyEditedAt: new Date(),
      createdById: session!.user.id,
      versions: {
        create: {
          version: (latestVersion?.version ?? 0) + 1,
          title,
          contentMarkdown: md,
          contentHtml,
          seoTitle: body.seoTitle ?? existing.seoTitle,
          metaDescription: body.metaDescription ?? existing.metaDescription,
          changeNote: "Manual edit",
        },
      },
    },
  });

  return jsonOk(article);
}

import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { getAccessibleWebsiteIds, canWriteWebsite } from "@/lib/rbac";
import { contentHash } from "@/lib/crypto";
import { ArticleStatus } from "@prisma/client";

export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const ids = await getAccessibleWebsiteIds(session!.user.id);
  const url = new URL(req.url);
  const websiteId = url.searchParams.get("websiteId");
  const status = url.searchParams.get("status") as ArticleStatus | null;

  const articles = await prisma.article.findMany({
    where: {
      websiteId: websiteId && ids.includes(websiteId) ? websiteId : { in: ids },
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      websiteId: true,
      title: true,
      slug: true,
      status: true,
      qualityScore: true,
      scheduledAt: true,
      publishedAt: true,
      publishedUrl: true,
      updatedAt: true,
      createdAt: true,
      website: { select: { id: true, name: true, domain: true } },
      category: { select: { id: true, name: true, slug: true } },
      topic: { select: { id: true, title: true, keyword: true, score: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return jsonOk({ articles });
}

export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const body = (await req.json()) as {
    websiteId: string;
    title: string;
    slug: string;
    contentMarkdown?: string;
    contentHtml?: string;
    seoTitle?: string;
    metaDescription?: string;
    categoryId?: string;
    tags?: string[];
  };
  if (!body.websiteId || !body.title || !body.slug) {
    return jsonError("websiteId, title, slug required");
  }
  if (!(await canWriteWebsite(session!.user.id, body.websiteId))) {
    return jsonError("Forbidden", 403);
  }

  const md = body.contentMarkdown ?? "";
  const article = await prisma.article.create({
    data: {
      websiteId: body.websiteId,
      title: body.title,
      slug: body.slug,
      contentMarkdown: md,
      contentHtml: body.contentHtml ?? "",
      seoTitle: body.seoTitle,
      metaDescription: body.metaDescription,
      categoryId: body.categoryId,
      tags: body.tags ?? [],
      contentHash: contentHash(body.title, md),
      createdById: session!.user.id,
      status: ArticleStatus.DRAFT,
      versions: {
        create: {
          version: 1,
          title: body.title,
          contentMarkdown: md,
          contentHtml: body.contentHtml ?? "",
          seoTitle: body.seoTitle,
          metaDescription: body.metaDescription,
          changeNote: "Manual create",
        },
      },
    },
  });
  return jsonOk(article, 201);
}

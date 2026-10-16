import { ArticleStatus, PublishMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { getAdapter, type CmsCredentials, type CmsPostInput } from "@/adapters";
import { isEmergencyStopped } from "@/lib/emergency";
import { writeAuditLog } from "@/lib/audit";

export async function publishArticle(
  articleId: string,
  opts: { verify?: boolean; force?: boolean; userId?: string } = {}
) {
  if (await isEmergencyStopped()) {
    throw new Error("Emergency stop is active");
  }

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    include: {
      website: { include: { settings: true } },
      category: true,
      publications: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  const settings = article.website.settings;
  if (!settings) throw new Error("Missing website settings");

  if (article.manuallyEditedAt && !opts.force) {
    throw new Error(
      "Article was manually edited — autopilot will not overwrite. Approve explicitly with force if needed."
    );
  }

  if (
    !opts.force &&
    settings.publishMode === PublishMode.DRAFT_ONLY
  ) {
    await prisma.article.update({
      where: { id: articleId },
      data: { status: ArticleStatus.DRAFT },
    });
    return { status: ArticleStatus.DRAFT, reason: "draft_only_mode" };
  }

  if (
    !opts.force &&
    settings.publishMode === PublishMode.APPROVAL_REQUIRED &&
    article.status !== ArticleStatus.PENDING_APPROVAL &&
    article.status !== ArticleStatus.SCHEDULED
  ) {
    // Allow publish when already approved path sets SCHEDULED/PENDING and user approves
  }

  if (
    settings.publishMode === PublishMode.APPROVAL_REQUIRED &&
    !opts.userId &&
    !opts.force &&
    article.status === ArticleStatus.DRAFT
  ) {
    await prisma.article.update({
      where: { id: articleId },
      data: { status: ArticleStatus.PENDING_APPROVAL },
    });
    return { status: ArticleStatus.PENDING_APPROVAL, reason: "needs_approval" };
  }

  // Duplicate publication protection
  if (article.cmsPostId && article.status === ArticleStatus.PUBLISHED) {
    return {
      status: ArticleStatus.PUBLISHED,
      reason: "already_published",
      cmsPostId: article.cmsPostId,
      publishedUrl: article.publishedUrl,
    };
  }

  const recentSuccess = article.publications.find((p) => p.success);
  if (recentSuccess?.cmsPostId) {
    return {
      status: ArticleStatus.PUBLISHED,
      reason: "idempotent_replay",
      cmsPostId: recentSuccess.cmsPostId,
      publishedUrl: recentSuccess.publishedUrl,
    };
  }

  if (!article.website.credentialsEnc) {
    throw new Error("Website CMS credentials not configured");
  }

  const credentials = decryptJson<CmsCredentials>(article.website.credentialsEnc);
  const adapter = getAdapter(article.website.cmsType);

  const input: CmsPostInput = {
    title: article.title,
    slug: article.slug,
    contentHtml: article.contentHtml,
    contentMarkdown: article.contentMarkdown,
    excerpt: article.excerpt,
    seoTitle: article.seoTitle,
    metaDescription: article.metaDescription,
    tags: article.tags,
    featuredImageUrl: article.featuredImageUrl,
    featuredImageAlt: article.featuredImageAlt,
    status: "publish",
    categoryName: article.category?.name,
  };

  const idempotencyKey = `publish:${article.id}:${article.contentHash ?? "v1"}`;
  const attempt = article.publications.length + 1;

  try {
    const result = article.cmsPostId
      ? await adapter.updatePost(credentials, article.cmsPostId, input)
      : await adapter.createPost(credentials, input);

    let verified = !opts.verify;
    let publishedUrl = result.publishedUrl;
    if (opts.verify) {
      const verification = await adapter.verifyPublication(
        credentials,
        result.cmsPostId
      );
      verified = verification.verified;
      publishedUrl = verification.publishedUrl || publishedUrl;
      if (!verified) {
        await prisma.publicationAttempt.create({
          data: {
            articleId,
            attempt,
            success: false,
            cmsPostId: result.cmsPostId,
            publishedUrl,
            errorLog: verification.error || "Verification failed",
            idempotencyKey: `${idempotencyKey}:verify-fail`,
          },
        });
        await prisma.article.update({
          where: { id: articleId },
          data: {
            status: ArticleStatus.FAILED,
            cmsPostId: result.cmsPostId,
            publishedUrl,
          },
        });
        throw new Error(verification.error || "Publication verification failed");
      }
    }

    await prisma.publicationAttempt.create({
      data: {
        articleId,
        attempt,
        success: true,
        cmsPostId: result.cmsPostId,
        publishedUrl,
        idempotencyKey,
      },
    });

    const updated = await prisma.article.update({
      where: { id: articleId },
      data: {
        status: ArticleStatus.PUBLISHED,
        cmsPostId: result.cmsPostId,
        publishedUrl,
        publishedAt: new Date(),
        approvedById: opts.userId,
      },
    });

    await writeAuditLog({
      organizationId: article.website.organizationId,
      userId: opts.userId,
      action: "article.publish",
      entityType: "Article",
      entityId: articleId,
      meta: { cmsPostId: result.cmsPostId, publishedUrl },
    });

    return {
      status: updated.status,
      cmsPostId: result.cmsPostId,
      publishedUrl,
      verified: opts.verify ? true : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.publicationAttempt.create({
      data: {
        articleId,
        attempt,
        success: false,
        errorLog: message,
        idempotencyKey: `${idempotencyKey}:fail:${attempt}`,
      },
    });
    await prisma.article.update({
      where: { id: articleId },
      data: { status: ArticleStatus.FAILED },
    });
    throw err;
  }
}

export async function approveArticle(articleId: string, userId: string) {
  await prisma.article.update({
    where: { id: articleId },
    data: {
      status: ArticleStatus.SCHEDULED,
      approvedById: userId,
      scheduledAt: new Date(),
    },
  });
  return publishArticle(articleId, { verify: true, force: true, userId });
}

export async function rejectArticle(articleId: string, userId: string, reason: string) {
  return prisma.article.update({
    where: { id: articleId },
    data: {
      status: ArticleStatus.REJECTED,
      rejectionReason: reason,
      approvedById: userId,
    },
  });
}

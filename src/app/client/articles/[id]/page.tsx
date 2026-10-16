import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canAccessWebsite, canWriteWebsite } from "@/lib/rbac";
import { ArticleEditor } from "@/components/ArticleEditor";

type Props = { params: Promise<{ id: string }> };

export default async function ClientArticlePage({ params }: Props) {
  const session = await requireUser();
  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" }, take: 5 },
      researchBrief: true,
      outline: true,
      internalLinks: true,
      publications: { orderBy: { createdAt: "desc" }, take: 5 },
      website: true,
    },
  });
  if (!article) notFound();
  if (!(await canAccessWebsite(session.user.id, article.websiteId))) notFound();
  const canWrite = await canWriteWebsite(session.user.id, article.websiteId);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{article.title}</h1>
          <p className="muted">
            {canWrite ? "You can approve or edit" : "View-only access"}
          </p>
        </div>
      </header>
      {canWrite ? (
        <ArticleEditor
          article={{
            id: article.id,
            title: article.title,
            slug: article.slug,
            status: article.status,
            contentMarkdown: article.contentMarkdown,
            contentHtml: article.contentHtml,
            seoTitle: article.seoTitle,
            metaDescription: article.metaDescription,
            tags: article.tags,
            featuredImageUrl: article.featuredImageUrl,
            featuredImageAlt: article.featuredImageAlt,
            publishedUrl: article.publishedUrl,
            cmsPostId: article.cmsPostId,
            qualityScore: article.qualityScore,
          }}
          research={article.researchBrief}
          outline={article.outline?.headings}
          versions={article.versions.map((v) => ({
            version: v.version,
            changeNote: v.changeNote,
            createdAt: v.createdAt.toISOString(),
          }))}
          publications={article.publications.map((p) => ({
            attempt: p.attempt,
            success: p.success,
            errorLog: p.errorLog,
            publishedUrl: p.publishedUrl,
            createdAt: p.createdAt.toISOString(),
          }))}
          internalLinks={article.internalLinks}
        />
      ) : (
        <section className="panel">
          <pre style={{ whiteSpace: "pre-wrap" }}>{article.contentMarkdown}</pre>
        </section>
      )}
    </>
  );
}

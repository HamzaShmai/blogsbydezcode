import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canAccessWebsite } from "@/lib/rbac";
import { ArticleEditor } from "@/components/ArticleEditor";

type Props = { params: Promise<{ id: string }> };

export default async function ArticleDetailPage({ params }: Props) {
  const session = await requireUser();
  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" }, take: 10 },
      researchBrief: true,
      outline: true,
      internalLinks: true,
      publications: { orderBy: { createdAt: "desc" }, take: 10 },
      website: true,
    },
  });
  if (!article) notFound();
  if (!(await canAccessWebsite(session.user.id, article.websiteId))) notFound();

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{article.title}</h1>
          <p className="muted">
            {article.website.name} · {article.status}
            {article.manuallyEditedAt ? " · manually edited (protected)" : ""}
          </p>
        </div>
      </header>
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
    </>
  );
}

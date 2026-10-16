"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  article: {
    id: string;
    title: string;
    slug: string;
    status: string;
    contentMarkdown: string;
    contentHtml: string;
    seoTitle: string | null;
    metaDescription: string | null;
    tags: string[];
    featuredImageUrl: string | null;
    featuredImageAlt: string | null;
    publishedUrl: string | null;
    cmsPostId: string | null;
    qualityScore: number | null;
  };
  research: {
    summary: string;
    hasLiveResearch: boolean;
    sourcesJson: string;
  } | null;
  outline?: string | null;
  versions: { version: number; changeNote: string | null; createdAt: string }[];
  publications: {
    attempt: number;
    success: boolean;
    errorLog: string | null;
    publishedUrl: string | null;
    createdAt: string;
  }[];
  internalLinks: { id: string; targetUrl: string; anchorText: string; reason: string | null }[];
};

export function ArticleEditor({
  article,
  research,
  outline,
  versions,
  publications,
  internalLinks,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [contentMarkdown, setContent] = useState(article.contentMarkdown);
  const [seoTitle, setSeoTitle] = useState(article.seoTitle || "");
  const [metaDescription, setMeta] = useState(article.metaDescription || "");
  const [tagsText, setTagsText] = useState((article.tags || []).join(", "));
  const [message, setMessage] = useState("");

  const tags = tagsText
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const focusKeyword = tags[0] || "";

  async function save() {
    const res = await fetch(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        contentMarkdown,
        seoTitle,
        metaDescription,
        tags,
      }),
    });
    setMessage(res.ok ? "Saved (manual edit protected from silent overwrite)" : "Save failed");
    router.refresh();
  }

  async function approve(action: "approve" | "reject") {
    const res = await fetch(`/api/articles/${article.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reason: action === "reject" ? "Rejected from editor" : undefined,
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Action ${action} complete` : data.error || "Failed");
    router.refresh();
  }

  return (
    <div className="panel-grid">
      <section className="panel stack">
        <label className="field">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Slug
          <input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <div className="panel" style={{ padding: "0.85rem 1rem", boxShadow: "none" }}>
          <p className="eyebrow">SEO pack (title · description · intent keywords)</p>
          <label className="field">
            SEO title <span className="muted">({seoTitle.length}/60)</span>
            <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </label>
          <label className="field">
            Meta description <span className="muted">({metaDescription.length}/160)</span>
            <textarea
              rows={3}
              value={metaDescription}
              onChange={(e) => setMeta(e.target.value)}
            />
          </label>
          <label className="field">
            Keywords (first = focus keyword)
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="focus keyword, secondary, service keyword"
            />
          </label>
          {tags.length ? (
            <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              {tags.map((t, i) => (
                <span key={t} className="pill">
                  {i === 0 ? "Focus: " : ""}
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <ul className="need-list" style={{ marginTop: "0.75rem" }}>
            <li>
              SEO title has focus keyword:{" "}
              <strong>
                {focusKeyword &&
                seoTitle.toLowerCase().includes(focusKeyword.toLowerCase().slice(0, 20))
                  ? "Yes"
                  : "No"}
              </strong>
            </li>
            <li>
              Meta has focus keyword:{" "}
              <strong>
                {focusKeyword &&
                metaDescription.toLowerCase().includes(focusKeyword.toLowerCase().slice(0, 16))
                  ? "Yes"
                  : "No"}
              </strong>
            </li>
            <li>
              Body has focus keyword:{" "}
              <strong>
                {focusKeyword &&
                contentMarkdown.toLowerCase().includes(focusKeyword.toLowerCase())
                  ? "Yes"
                  : "No"}
              </strong>
            </li>
          </ul>
        </div>
        <label className="field">
          Content (Markdown)
          <textarea
            rows={14}
            value={contentMarkdown}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <div className="field">
          <span>Preview (keywords highlighted)</span>
          <div
            className="article-preview"
            dangerouslySetInnerHTML={{ __html: article.contentHtml || "<p>No HTML yet</p>" }}
          />
        </div>
        <div className="row">
          <button className="btn secondary" type="button" onClick={save}>
            Save draft
          </button>
          <button className="btn" type="button" onClick={() => approve("approve")}>
            Approve & publish
          </button>
          <button className="btn danger" type="button" onClick={() => approve("reject")}>
            Reject
          </button>
        </div>
        {message ? <p className="muted">{message}</p> : null}
        {article.publishedUrl ? (
          <p>
            Live:{" "}
            <a href={article.publishedUrl} target="_blank" rel="noreferrer">
              {article.publishedUrl}
            </a>{" "}
            (CMS ID {article.cmsPostId})
          </p>
        ) : null}
      </section>

      <div className="stack">
        <section className="panel">
          <h2>Quality & image</h2>
          <p>Score: {article.qualityScore?.toFixed(2) ?? "—"}</p>
          {article.featuredImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.featuredImageUrl}
              alt={article.featuredImageAlt || ""}
              style={{ width: "100%", borderRadius: 12, marginTop: 8 }}
            />
          ) : null}
          <p className="muted">{article.featuredImageAlt}</p>
        </section>
        <section className="panel">
          <h2>Research brief</h2>
          {research ? (
            <>
              <p>{research.summary}</p>
              <div className="badge">
                {research.hasLiveResearch ? "live research" : "no live research"}
              </div>
            </>
          ) : (
            <p className="muted">No research brief</p>
          )}
        </section>
        <section className="panel">
          <h2>Outline</h2>
          <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>
            {outline || "[]"}
          </pre>
        </section>
        <section className="panel">
          <h2>Internal links</h2>
          {internalLinks.map((l) => (
            <div key={l.id} className="list-item">
              <span>{l.anchorText}</span>
              <span className="muted">{l.targetUrl}</span>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Version history</h2>
          {versions.map((v) => (
            <div key={v.version} className="list-item">
              <span>v{v.version}</span>
              <span className="muted">
                {v.changeNote} · {v.createdAt.slice(0, 19)}
              </span>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Publication attempts</h2>
          {publications.map((p) => (
            <div key={`${p.attempt}-${p.createdAt}`} className="list-item">
              <span>
                #{p.attempt} {p.success ? "OK" : "FAIL"}
              </span>
              <span className="muted">{p.errorLog || p.publishedUrl || p.createdAt}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

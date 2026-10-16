"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AnalyzeResult = {
  pagesCrawled?: number;
  keywordsFound?: number;
  gapsFound?: number;
  topicsCreated?: number;
  niche?: string;
  disclaimer?: string;
  article?: {
    articleId?: string;
    status?: string;
    seo?: {
      seoTitle?: string;
      metaDescription?: string;
      focusKeyword?: string;
      searchIntent?: string;
    };
    publishedUrl?: string;
    autoPublished?: boolean;
  };
  seo?: {
    seoTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    searchIntent?: string;
  };
  gaps?: { keyword: string; reason: string; source: string }[];
  topKeywords?: { keyword: string; score: number }[];
};

export function WebsiteEasyWorkflow({
  websiteId,
  domain,
}: {
  websiteId: string;
  domain: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  async function run(action: "analyze" | "write" | "full") {
    setBusy(action);
    setLog(
      action === "analyze"
        ? "Reading your site niche → keywords → only on-topic Google Suggest gaps…"
        : action === "write"
          ? "Thinking → matching your blog design → writing → publish if CMS connected…"
          : "Full run: niche analyze → on-topic keywords → write → auto-publish if CMS…"
    );
    const res = await fetch(`/api/websites/${websiteId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setLog(data.error || "Failed");
      return;
    }
    setResult(data);
    if (action === "analyze") {
      setLog(
        `Niche: ${data.niche || "detected"} · ${data.pagesCrawled ?? 0} pages · ${data.gapsFound ?? 0} on-topic keyword gaps · ${data.topicsCreated ?? 0} topics.`
      );
    } else {
      const a = data.article || data;
      setLog(
        a.autoPublished
          ? `Published to live site (style-matched). ${a.publishedUrl || ""}`
          : a.cmsConnected
            ? `Draft ready — CMS publish pending/failed. Open article to retry.`
            : `Draft ready (connect CMS to auto-post next time). Provider: ${a.provider || "ai"}`
      );
    }
    router.refresh();
  }

  const articleId =
    result?.article?.articleId ||
    (result as { article?: { articleId?: string } } | null)?.article?.articleId;

  return (
    <section className="panel panel-rich workflow-panel">
      <p className="eyebrow">Do this in order</p>
      <h2>3 clicks: analyze → keywords → blog</h2>
      <p className="muted">
        Site: <strong>{domain}</strong>. Button 1–2 = free SEO + keyword gaps.
        Button 3 = AI writes blog (auto-publishes if WordPress/Shopify connected).
      </p>

      <div className="workflow-steps">
        <button
          className="workflow-step"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run("analyze")}
        >
          <span>1</span>
          <div>
            <strong>Deep analyze</strong>
            <em>Pages, services, on-page keywords</em>
          </div>
        </button>
        <button
          className="workflow-step"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run("analyze")}
        >
          <span>2</span>
          <div>
            <strong>Find gaps</strong>
            <em>Google Suggest + crawl misses</em>
          </div>
        </button>
        <button
          className="workflow-step primary"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run("write")}
        >
          <span>3</span>
          <div>
            <strong>Write blog</strong>
            <em>Content + links + featured image</em>
          </div>
        </button>
      </div>

      <div className="row" style={{ marginTop: "1rem" }}>
        <button
          className="btn"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run("full")}
        >
          {busy === "full" ? "Running…" : "Do all three in one click"}
        </button>
        <Link className="btn secondary" href="/agency/articles">
          Open articles
        </Link>
      </div>

      {log ? <p className="workflow-log">{busy ? `${log}` : log}</p> : null}
      {result?.disclaimer ? (
        <div className="disclaimer">{result.disclaimer}</div>
      ) : null}

      {result?.niche ? (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Detected niche: <strong>{result.niche}</strong> — suggestions stay in this topic.
        </p>
      ) : null}

      {(result?.article?.seo || result?.seo) && (
        <div className="disclaimer" style={{ marginTop: "0.75rem" }}>
          <strong>Blog SEO</strong>
          <div>
            Intent:{" "}
            <strong>
              {(result.article?.seo || result.seo)?.searchIntent || "—"}
            </strong>
          </div>
          <div>Title: {(result.article?.seo || result.seo)?.seoTitle}</div>
          <div>
            Description: {(result.article?.seo || result.seo)?.metaDescription}
          </div>
          <div>
            Keyword: {(result.article?.seo || result.seo)?.focusKeyword}
          </div>
        </div>
      )}

      {result?.gaps?.length ? (
        <div className="gap-list">
          <h3>On-topic keyword gaps</h3>
          {result.gaps.slice(0, 8).map((g) => (
            <div key={g.keyword} className="site-row">
              <div>
                <strong>{g.keyword}</strong>
                <span className="muted">{g.reason}</span>
              </div>
              <span className="pill">{g.source}</span>
            </div>
          ))}
        </div>
      ) : null}

      {articleId ? (
        <p style={{ marginTop: "1rem" }}>
          <Link className="btn" href={`/agency/articles/${articleId}`}>
            Review generated blog →
          </Link>
        </p>
      ) : null}
    </section>
  );
}

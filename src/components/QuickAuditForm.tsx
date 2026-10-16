"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Issue = {
  id: string;
  pageUrl: string;
  code: string;
  message: string;
  severity: string;
};

export function QuickAuditForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    websiteId: string;
    domain: string;
    aiProvider: string;
    healthScore: number | null;
    issues: Issue[];
    analysis?: {
      pagesCrawled?: number;
      gapsFound?: number;
      topicsCreated?: number;
      gaps?: { keyword: string; reason: string; source: string }[];
    };
    article?: { articleId?: string; status?: string; skipped?: boolean };
    note?: string;
  } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/quick-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: form.get("organizationId"),
        domain: form.get("domain"),
        name: form.get("name") || undefined,
        writeBlog: form.get("writeBlog") === "on",
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Audit failed");
      return;
    }
    setResult(data);
    router.refresh();
  }

  return (
    <section className="panel panel-rich">
      <p className="eyebrow">Free path</p>
      <h2>Audit site + write blog (no CMS needed)</h2>
      <p className="muted">
        Paste any live website link. We crawl pages, list SEO issues, find keyword gaps
        (Google Suggest), and draft a blog with Grok when your API key is set. Publish
        Connect CMS later — then new posts auto-publish in your site’s blog style.
      </p>

      <form className="wizard-body" onSubmit={onSubmit} style={{ marginTop: "1.25rem" }}>
        <label className="gate-field">
          <span>Organization</span>
          <select name="organizationId" required defaultValue={organizations[0]?.id}>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="gate-field">
          <span>Website link</span>
          <input
            name="domain"
            required
            placeholder="www.example.com"
            inputMode="url"
          />
        </label>
        <label className="gate-field">
          <span>Display name (optional)</span>
          <input name="name" placeholder="Example Site" />
        </label>
        <label className="gate-field" style={{ flexDirection: "row", alignItems: "center", gap: "0.6rem", textTransform: "none", letterSpacing: 0 }}>
          <input name="writeBlog" type="checkbox" defaultChecked />
          <span style={{ color: "var(--ink)", fontSize: "0.95rem" }}>
            Also write 1 blog draft (internal links + featured image)
          </span>
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Analyzing… (can take ~1–2 min)" : "Run free audit + blog"}
        </button>
      </form>

      {error ? <p className="gate-error">{error}</p> : null}

      {result ? (
        <div style={{ marginTop: "1.5rem" }}>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">SEO health</div>
              <div className="stat-value">{result.healthScore ?? "—"}</div>
              <div className="badge">measured</div>
            </div>
            <div className="stat">
              <div className="stat-label">Pages crawled</div>
              <div className="stat-value">{result.analysis?.pagesCrawled ?? 0}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Keyword gaps</div>
              <div className="stat-value">{result.analysis?.gapsFound ?? 0}</div>
            </div>
            <div className="stat">
              <div className="stat-label">AI writer</div>
              <div className="stat-value" style={{ fontSize: "1.2rem" }}>
                {result.aiProvider}
              </div>
            </div>
          </div>

          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 520 }}>
            Audit issues
          </h3>
          {result.issues.length ? (
            result.issues.slice(0, 12).map((i) => (
              <div key={i.id} className="site-row">
                <div>
                  <strong>{i.code}</strong>
                  <span className="muted">
                    {i.message} — {i.pageUrl}
                  </span>
                </div>
                <span className="pill">{i.severity}</span>
              </div>
            ))
          ) : (
            <p className="muted">No unresolved issues stored (or crawl could not fetch pages).</p>
          )}

          {result.analysis?.gaps?.length ? (
            <>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 520,
                  marginTop: "1.25rem",
                }}
              >
                Missing keyword opportunities
              </h3>
              {result.analysis.gaps.slice(0, 8).map((g) => (
                <div key={g.keyword} className="site-row">
                  <div>
                    <strong>{g.keyword}</strong>
                    <span className="muted">{g.reason}</span>
                  </div>
                  <span className="pill">{g.source}</span>
                </div>
              ))}
            </>
          ) : null}

          <div className="row" style={{ marginTop: "1.25rem" }}>
            <Link className="btn" href={`/agency/websites/${result.websiteId}`}>
              Open site desk
            </Link>
            {result.article?.articleId ? (
              <Link className="btn secondary" href={`/agency/articles/${result.article.articleId}`}>
                Open blog draft
              </Link>
            ) : null}
          </div>
          {result.note ? <div className="disclaimer">{result.note}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

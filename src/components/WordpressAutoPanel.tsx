"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function WordpressAutoPanel({
  websiteId,
  domain,
  hasCredentials,
  cmsType,
}: {
  websiteId: string;
  domain: string;
  hasCredentials: boolean;
  cmsType: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [connected, setConnected] = useState(hasCredentials);
  const [seo, setSeo] = useState<{
    seoTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    searchIntent?: string;
  } | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  async function saveWp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setLog("Saving WordPress credentials & testing login…");
    const form = new FormData(e.currentTarget);
    const baseUrl = String(form.get("baseUrl") || "").replace(/\/$/, "");
    const username = String(form.get("username") || "");
    const applicationPassword = String(form.get("applicationPassword") || "");

    const patch = await fetch(`/api/websites/${websiteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmsType: "WORDPRESS",
        credentials: { baseUrl, username, applicationPassword },
        settings: {
          publishMode: "FULL_AUTOPILOT",
          autopilotEnabled: true,
          aiProvider: "grok",
        },
      }),
    });
    if (!patch.ok) {
      const data = await patch.json().catch(() => ({}));
      setLog(data.error || "Could not save credentials");
      setBusy(false);
      return;
    }

    const test = await fetch(`/api/websites/${websiteId}/test-connection`, {
      method: "POST",
    });
    const testData = await test.json();
    if (!test.ok || !testData.ok) {
      setLog(testData.message || testData.error || "WordPress login failed");
      setBusy(false);
      return;
    }
    setConnected(true);
    setLog(testData.message || "WordPress connected");
    setBusy(false);
    router.refresh();
  }

  async function runAutopilot() {
    setBusy(true);
    setLog(
      "Automation: analyze niche → write detailed SEO blog → image + alt → internal links → publish to WordPress posts…"
    );
    try {
      const res = await fetch(`/api/websites/${websiteId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autopilot" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLog(data.error || "Autopilot failed");
        setBusy(false);
        return;
      }
      const article = data.article || {};
      setSeo(article.seo || data.seo || null);
      setArticleId(article.articleId || null);
      setPublishedUrl(article.publishedUrl || null);
      setLog(
        article.autoPublished
          ? `Live on WordPress: ${article.publishedUrl || "published"}`
          : article.cmsConnected
            ? `Blog ready — publish: ${article.status || "check article"}. ${article.publishResult?.error || ""}`
            : "Connect WordPress credentials first."
      );
    } catch (e) {
      setLog(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="panel panel-rich" style={{ marginBottom: "1rem" }}>
      <p className="eyebrow">WordPress automation</p>
      <h2>1-click: write → image → internal links → publish</h2>
      <p className="muted">
        Site: <strong>{domain}</strong>
        {cmsType !== "WORDPRESS" ? " (will switch CMS to WordPress)" : ""}.
        Agent uses secure <strong>WP REST API + Application Password</strong> —
        creates detailed SEO post with title, meta description, intent keyword,
        featured image + alt, tags, and internal links.
      </p>

      {!connected ? (
        <form className="stack" onSubmit={saveWp} style={{ marginTop: "1rem" }}>
          <label className="field">
            WordPress site URL
            <input
              name="baseUrl"
              required
              placeholder="https://yoursite.com"
              defaultValue={domain.startsWith("http") ? domain : `https://${domain}`}
            />
          </label>
          <label className="field">
            WP username
            <input name="username" required placeholder="admin" autoComplete="username" />
          </label>
          <label className="field">
            Application password
            <input
              name="applicationPassword"
              required
              type="password"
              placeholder="xxxx xxxx xxxx xxxx"
              autoComplete="current-password"
            />
          </label>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            WP Admin → Users → Profile → Application Passwords → Add New. Paste
            that password here (not your normal login password).
          </p>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Connecting…" : "Connect WordPress"}
          </button>
        </form>
      ) : (
        <div className="row" style={{ marginTop: "1rem" }}>
          <button className="btn" type="button" disabled={busy} onClick={runAutopilot}>
            {busy ? "Publishing…" : "Auto write & publish to WordPress"}
          </button>
          <span className="pill">Connected</span>
        </div>
      )}

      {log ? <p className="workflow-log">{log}</p> : null}

      {seo ? (
        <div className="disclaimer" style={{ marginTop: "1rem" }}>
          <strong>SEO pack</strong>
          <div style={{ marginTop: "0.35rem" }}>
            Intent: <strong>{seo.searchIntent || "—"}</strong>
          </div>
          <div>Title: {seo.seoTitle}</div>
          <div>Description: {seo.metaDescription}</div>
          <div>Focus keyword: {seo.focusKeyword}</div>
        </div>
      ) : null}

      {publishedUrl ? (
        <p style={{ marginTop: "0.75rem" }}>
          <a className="btn" href={publishedUrl} target="_blank" rel="noreferrer">
            Open live post →
          </a>
        </p>
      ) : articleId ? (
        <p style={{ marginTop: "0.75rem" }}>
          <Link className="btn secondary" href={`/agency/articles/${articleId}`}>
            Review article →
          </Link>
        </p>
      ) : null}
    </section>
  );
}

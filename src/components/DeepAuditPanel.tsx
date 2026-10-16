"use client";

import { useState } from "react";

type AuditResult = {
  auditId?: string;
  healthScore?: number;
  pagesCrawled?: number;
  issueCount?: number;
  bySeverity?: Record<string, number>;
  recommendations?: string[];
};

export function DeepAuditPanel({
  websiteId,
  latestAuditId,
  latestScore,
}: {
  websiteId: string;
  latestAuditId?: string | null;
  latestScore?: number | null;
}) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);

  const auditId = result?.auditId || latestAuditId || null;
  const score = result?.healthScore ?? latestScore ?? null;

  async function runDeepAudit() {
    setBusy(true);
    setLog("Deep audit running — crawling pages, robots, sitemap, on-page SEO…");
    try {
      const res = await fetch(`/api/websites/${websiteId}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 20 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLog(data.error || "Audit failed");
        setBusy(false);
        return;
      }
      setResult(data);
      setLog(
        `Done. Health ${data.healthScore}/100 · ${data.pagesCrawled} pages · ${data.issueCount} issues.`
      );
    } catch (e) {
      setLog(e instanceof Error ? e.message : "Audit failed");
    }
    setBusy(false);
  }

  function downloadPdf() {
    if (!auditId && !latestAuditId) {
      setLog("Run a deep audit first, then download PDF.");
      return;
    }
    const q = auditId ? `?auditId=${auditId}` : "";
    window.location.href = `/api/websites/${websiteId}/audit/pdf${q}`;
  }

  const sev = result?.bySeverity;

  return (
    <section className="panel panel-rich" style={{ marginBottom: "1rem" }}>
      <p className="eyebrow">SEO health</p>
      <h2>Deep website audit + PDF</h2>
      <p className="muted">
        Crawls many pages: titles, meta, H1, alt text, HTTPS, canonical, Open Graph,
        schema, thin content, robots.txt, sitemap, and more. Then download a PDF report.
      </p>

      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" type="button" disabled={busy} onClick={runDeepAudit}>
          {busy ? "Auditing…" : "Run deep audit"}
        </button>
        <button
          className="btn secondary"
          type="button"
          disabled={busy || (!auditId && score == null)}
          onClick={downloadPdf}
        >
          Download PDF report
        </button>
      </div>

      {score != null ? (
        <div className="stat-grid" style={{ marginTop: "1rem", marginBottom: 0 }}>
          <div className="stat">
            <div className="stat-label">Health score</div>
            <div className="stat-value">{score}</div>
          </div>
          {result?.pagesCrawled != null ? (
            <div className="stat">
              <div className="stat-label">Pages</div>
              <div className="stat-value">{result.pagesCrawled}</div>
            </div>
          ) : null}
          {result?.issueCount != null ? (
            <div className="stat">
              <div className="stat-label">Issues</div>
              <div className="stat-value">{result.issueCount}</div>
            </div>
          ) : null}
          {sev ? (
            <div className="stat">
              <div className="stat-label">Critical / Error</div>
              <div className="stat-value">
                {(sev.CRITICAL || 0) + (sev.ERROR || 0)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {log ? <p className="workflow-log">{log}</p> : null}

      {result?.recommendations?.length ? (
        <div style={{ marginTop: "0.75rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.4rem" }}>Fix these next</h3>
          <ul className="need-list">
            {result.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

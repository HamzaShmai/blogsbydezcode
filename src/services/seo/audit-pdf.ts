import PDFDocument from "pdfkit";
import type { AuditSummary } from "@/services/seo/audit";
import type { SeoIssue } from "@prisma/client";

function severityColor(sev: string): string {
  switch (sev) {
    case "CRITICAL":
      return "#991b1b";
    case "ERROR":
      return "#dc2626";
    case "WARNING":
      return "#c2410c";
    default:
      return "#6d28d9";
  }
}

export async function buildAuditPdf(input: {
  websiteName: string;
  domain: string;
  summary: AuditSummary;
  issues: Pick<SeoIssue, "pageUrl" | "code" | "message" | "severity">[];
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: "A4", info: {
    Title: `SEO Audit — ${input.websiteName}`,
    Author: "PulseRank",
    Subject: `Deep SEO audit for ${input.domain}`,
  }});

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const purple = "#6d28d9";
  const ink = "#1a1430";
  const muted = "#6b6280";

  // Header
  doc.fillColor(purple).fontSize(22).text("PulseRank", { continued: false });
  doc.fillColor(ink).fontSize(16).text("Deep SEO Audit Report", { continued: false });
  doc.moveDown(0.4);
  doc.fillColor(muted).fontSize(10);
  doc.text(`Website: ${input.websiteName}`);
  doc.text(`Domain: ${input.domain}`);
  doc.text(`Generated: ${new Date(input.summary.generatedAt).toLocaleString()}`);
  doc.moveDown(0.8);

  // Score box
  doc.fillColor(purple).fontSize(28).text(`${input.summary.healthScore}`, {
    continued: true,
  });
  doc.fillColor(ink).fontSize(12).text("  / 100 health score");
  doc.fillColor(muted).fontSize(10);
  doc.text(
    `Pages audited: ${input.summary.pagesCrawled}  ·  Issues found: ${input.summary.issueCount}`
  );
  doc.moveDown(0.6);

  doc.fillColor(ink).fontSize(12).text("Issues by severity", { underline: false });
  doc.fillColor(muted).fontSize(10);
  const sev = input.summary.bySeverity || {};
  doc.text(
    `Critical: ${sev.CRITICAL || 0}   Error: ${sev.ERROR || 0}   Warning: ${sev.WARNING || 0}   Info: ${sev.INFO || 0}`
  );
  doc.moveDown(0.8);

  // Site checks
  doc.fillColor(purple).fontSize(13).text("Site-level checks");
  doc.moveDown(0.3);
  for (const c of input.summary.siteChecks || []) {
    doc.fillColor(c.ok ? "#15803d" : "#dc2626").fontSize(10);
    doc.text(`${c.ok ? "✓" : "✗"} ${c.code}: ${c.detail}`);
  }
  doc.moveDown(0.7);

  // Recommendations
  doc.fillColor(purple).fontSize(13).text("Priority recommendations");
  doc.moveDown(0.3);
  doc.fillColor(ink).fontSize(10);
  for (const r of input.summary.recommendations || []) {
    doc.text(`• ${r}`, { indent: 8 });
  }
  doc.moveDown(0.7);

  // Top issue types
  if (input.summary.topIssues?.length) {
    doc.fillColor(purple).fontSize(13).text("Most common issue types");
    doc.moveDown(0.3);
    for (const t of input.summary.topIssues.slice(0, 10)) {
      doc.fillColor(severityColor(t.severity)).fontSize(10);
      doc.text(`${t.code}  ×${t.count}  (${t.severity})`);
    }
    doc.moveDown(0.7);
  }

  // Pages table summary
  if (input.summary.pages?.length) {
    doc.fillColor(purple).fontSize(13).text("Pages audited");
    doc.moveDown(0.3);
    for (const p of input.summary.pages.slice(0, 18)) {
      doc.fillColor(ink).fontSize(9).text(p.url, { continued: false });
      doc.fillColor(muted).fontSize(8);
      doc.text(
        `Title: ${(p.title || "—").slice(0, 80)}  ·  Words: ${p.wordCount}  ·  Alt missing: ${p.imagesMissingAlt}/${p.images}  ·  Canonical: ${p.hasCanonical ? "yes" : "no"}  ·  OG: ${p.hasOg ? "yes" : "no"}`
      );
      doc.moveDown(0.25);
      if (doc.y > 720) doc.addPage();
    }
    doc.moveDown(0.5);
  }

  // Issue list
  doc.addPage();
  doc.fillColor(purple).fontSize(14).text("Full issue list");
  doc.moveDown(0.4);

  const issues = input.issues.slice(0, 120);
  if (!issues.length) {
    doc.fillColor(muted).fontSize(10).text("No issues recorded.");
  } else {
    for (const issue of issues) {
      if (doc.y > 740) doc.addPage();
      doc.fillColor(severityColor(issue.severity)).fontSize(9).text(`[${issue.severity}] ${issue.code}`);
      doc.fillColor(ink).fontSize(9).text(issue.message);
      doc.fillColor(muted).fontSize(8).text(issue.pageUrl);
      doc.moveDown(0.35);
    }
  }

  doc.moveDown(1);
  doc.fillColor(muted).fontSize(8);
  doc.text(
    "PulseRank audit — recommendations only. Scores are heuristic and not a Google ranking guarantee.",
    { align: "left" }
  );

  doc.end();
  return done;
}

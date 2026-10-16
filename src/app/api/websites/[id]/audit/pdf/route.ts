import { requireSession, jsonError } from "@/lib/api";
import { canAccessWebsite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { buildAuditPdf } from "@/services/seo/audit-pdf";
import type { AuditSummary } from "@/services/seo/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Download latest (or ?auditId=) deep audit as PDF */
export async function GET(req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canAccessWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }

  const url = new URL(req.url);
  const auditId = url.searchParams.get("auditId");

  const website = await prisma.website.findUnique({
    where: { id },
    select: { id: true, name: true, domain: true },
  });
  if (!website) return jsonError("Not found", 404);

  const audit = await prisma.seoAudit.findFirst({
    where: auditId ? { id: auditId, websiteId: id } : { websiteId: id },
    orderBy: { startedAt: "desc" },
    include: {
      issues: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }], take: 150 },
    },
  });
  if (!audit) {
    return jsonError("No audit yet — run a deep audit first", 404);
  }

  let summary: AuditSummary;
  try {
    summary = JSON.parse(audit.summaryJson || "{}") as AuditSummary;
  } catch {
    summary = {
      domain: website.domain,
      healthScore: audit.healthScore ?? 0,
      pagesCrawled: audit.pagesCrawled,
      issueCount: audit.issues.length,
      bySeverity: {},
      siteChecks: [],
      pages: [],
      topIssues: [],
      recommendations: ["Re-run deep audit to refresh full report details."],
      generatedAt: (audit.finishedAt || audit.startedAt).toISOString(),
    };
  }

  if (!summary.domain) summary.domain = website.domain;
  if (!summary.generatedAt) {
    summary.generatedAt = (audit.finishedAt || audit.startedAt).toISOString();
  }
  if (!summary.healthScore && audit.healthScore != null) {
    summary.healthScore = audit.healthScore;
  }

  const pdf = await buildAuditPdf({
    websiteName: website.name,
    domain: website.domain,
    summary,
    issues: audit.issues,
  });

  const safeName = website.domain.replace(/[^a-z0-9.-]/gi, "_").slice(0, 40);
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pulserank-audit-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

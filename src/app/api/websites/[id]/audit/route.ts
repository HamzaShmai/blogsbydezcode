import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canWriteWebsite, canAccessWebsite } from "@/lib/rbac";
import { crawlSeoAudit } from "@/services/seo/audit";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** GET latest audit summary */
export async function GET(_req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canAccessWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }

  const audit = await prisma.seoAudit.findFirst({
    where: { websiteId: id },
    orderBy: { startedAt: "desc" },
    include: {
      issues: {
        where: { resolved: false },
        orderBy: { severity: "asc" },
        take: 80,
      },
    },
  });
  if (!audit) return jsonOk({ audit: null });

  let summary = {};
  try {
    summary = JSON.parse(audit.summaryJson || "{}");
  } catch {
    summary = {};
  }

  return jsonOk({
    audit: {
      id: audit.id,
      healthScore: audit.healthScore,
      pagesCrawled: audit.pagesCrawled,
      startedAt: audit.startedAt,
      finishedAt: audit.finishedAt,
      summary,
      issues: audit.issues,
    },
  });
}

/** POST run deep SEO audit */
export async function POST(req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canWriteWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }

  const body = (await req.json().catch(() => ({}))) as { maxPages?: number };
  try {
    const result = await crawlSeoAudit(id, {
      maxPages: Math.min(30, Math.max(5, body.maxPages ?? 20)),
    });
    return jsonOk({ ok: true, ...result });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : String(e), 500);
  }
}

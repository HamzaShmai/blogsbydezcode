import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canWriteWebsite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { approveArticle, rejectArticle } from "@/services/publish/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return jsonError("Not found", 404);
  if (!(await canWriteWebsite(session!.user.id, article.websiteId))) {
    return jsonError("Forbidden", 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject";
    reason?: string;
  };

  if (body.action === "reject") {
    const updated = await rejectArticle(
      id,
      session!.user.id,
      body.reason || "Rejected"
    );
    return jsonOk(updated);
  }

  try {
    const result = await approveArticle(id, session!.user.id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : String(e), 400);
  }
}

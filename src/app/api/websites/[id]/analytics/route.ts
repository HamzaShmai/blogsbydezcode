import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canAccessWebsite } from "@/lib/rbac";
import { getWebsiteAnalytics } from "@/services/analytics/report";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canAccessWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }
  return jsonOk(await getWebsiteAnalytics(id));
}

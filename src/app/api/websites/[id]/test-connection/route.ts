import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canWriteWebsite } from "@/lib/rbac";
import { decryptJson } from "@/lib/crypto";
import { getAdapter, type CmsCredentials } from "@/adapters";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canWriteWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }
  const website = await prisma.website.findUnique({ where: { id } });
  if (!website?.credentialsEnc) return jsonError("No credentials stored", 400);
  const credentials = decryptJson<CmsCredentials>(website.credentialsEnc);
  const adapter = getAdapter(website.cmsType);
  const result = await adapter.testConnection(credentials);
  return jsonOk(result);
}

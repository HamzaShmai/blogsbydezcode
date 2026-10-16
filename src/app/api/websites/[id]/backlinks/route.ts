import { BacklinkStatus } from "@prisma/client";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canAccessWebsite, canWriteWebsite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { runBacklinkAgent } from "@/services/backlinks/agent";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canAccessWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }

  const prospects = await prisma.backlinkProspect.findMany({
    where: { websiteId: id },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });
  const total = await prisma.backlinkProspect.count({ where: { websiteId: id } });
  return jsonOk({ prospects, total });
}

/** Run AI backlink agent */
export async function POST(_req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canWriteWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }

  try {
    const result = await runBacklinkAgent(id);
    return jsonOk({ ok: true, ...result });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : String(e), 500);
  }
}

/** Update prospect status */
export async function PATCH(req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canWriteWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    prospectId: string;
    status: BacklinkStatus;
  };
  if (!body.prospectId || !body.status) {
    return jsonError("prospectId and status required");
  }
  if (!Object.values(BacklinkStatus).includes(body.status)) {
    return jsonError("Invalid status");
  }

  const prospect = await prisma.backlinkProspect.findFirst({
    where: { id: body.prospectId, websiteId: id },
  });
  if (!prospect) return jsonError("Not found", 404);

  const updated = await prisma.backlinkProspect.update({
    where: { id: prospect.id },
    data: { status: body.status },
  });
  return jsonOk({ prospect: updated });
}

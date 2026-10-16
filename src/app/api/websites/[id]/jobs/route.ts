import { JobType } from "@prisma/client";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canWriteWebsite, canAccessWebsite } from "@/lib/rbac";
import { enqueueJob } from "@/lib/queue";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canAccessWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }
  const jobs = await prisma.job.findMany({
    where: { websiteId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { logs: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return jsonOk({ jobs });
}

export async function POST(req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canWriteWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }
  const body = (await req.json()) as {
    type: JobType;
    payload?: Record<string, unknown>;
  };
  if (!body.type || !Object.values(JobType).includes(body.type)) {
    return jsonError("Valid job type required");
  }
  try {
    const job = await enqueueJob({
      type: body.type,
      websiteId: id,
      payload: { ...(body.payload ?? {}), requestedBy: session!.user.id },
    });
    return jsonOk(job, 201);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : String(e), 409);
  }
}

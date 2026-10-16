import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canAccessWebsite, canWriteWebsite } from "@/lib/rbac";
import { enqueueJob } from "@/lib/queue";
import { JobType } from "@prisma/client";

export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const websiteId = new URL(req.url).searchParams.get("websiteId");
  if (!websiteId) return jsonError("websiteId required");
  if (!(await canAccessWebsite(session!.user.id, websiteId))) {
    return jsonError("Forbidden", 403);
  }
  const topics = await prisma.topicRecommendation.findMany({
    where: { websiteId },
    orderBy: [{ feedbackScore: "desc" }, { score: "desc" }],
    take: 50,
  });
  const opportunities = await prisma.contentOpportunity.findMany({
    where: { websiteId, dismissed: false },
    orderBy: { score: "desc" },
    take: 50,
  });
  return jsonOk({
    topics,
    opportunities,
    disclaimer: "Scores are recommendations, not ranking guarantees.",
  });
}

export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const body = (await req.json()) as {
    websiteId: string;
    action: "discover" | "generate";
    topicId?: string;
  };
  if (!(await canWriteWebsite(session!.user.id, body.websiteId))) {
    return jsonError("Forbidden", 403);
  }
  if (body.action === "discover") {
    const job = await enqueueJob({
      type: JobType.DISCOVER_TOPICS,
      websiteId: body.websiteId,
      payload: {},
    });
    return jsonOk(job, 201);
  }
  const job = await enqueueJob({
    type: JobType.GENERATE_ARTICLE,
    websiteId: body.websiteId,
    payload: { topicId: body.topicId },
  });
  return jsonOk(job, 201);
}

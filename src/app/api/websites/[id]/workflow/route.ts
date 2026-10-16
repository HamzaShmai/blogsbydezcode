import { JobType, PublishMode } from "@prisma/client";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canWriteWebsite } from "@/lib/rbac";
import { analyzeSiteAndKeywords } from "@/services/seo/analyze-workflow";
import { researchAndGenerate } from "@/services/articles/pipeline";
import { syncGsc } from "@/services/gsc/sync";
import { enqueueJob } from "@/lib/queue";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Easy blog workflow:
 * - analyze / write / full
 * - autopilot: enable WP publish mode → analyze → detailed blog → force publish
 */
export async function POST(req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canWriteWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    action: "analyze" | "write" | "full" | "autopilot";
    topicId?: string;
  };

  try {
    if (body.action === "analyze") {
      const result = await analyzeSiteAndKeywords(id);
      await enqueueJob({
        type: JobType.DISCOVER_TOPICS,
        websiteId: id,
        payload: { source: "workflow_analyze", at: new Date().toISOString() },
      }).catch(() => undefined);
      return jsonOk({ step: "analyze", ...result });
    }

    if (body.action === "write") {
      const result = await researchAndGenerate(id, {
        topicId: body.topicId,
        forceInternalLinks: true,
      });
      return jsonOk({ step: "write", ...result });
    }

    if (body.action === "full") {
      await syncGsc(id, { source: "workflow_full" }).catch(() => ({
        synced: false,
      }));
      const analysis = await analyzeSiteAndKeywords(id);
      const article = await researchAndGenerate(id, { forceInternalLinks: true });
      const topicCount = await prisma.topicRecommendation.count({
        where: { websiteId: id, selected: false },
      });
      return jsonOk({
        step: "full",
        ...analysis,
        article,
        openTopics: topicCount,
      });
    }

    if (body.action === "autopilot") {
      const website = await prisma.website.findUnique({
        where: { id },
        select: { credentialsEnc: true, cmsType: true },
      });
      if (!website?.credentialsEnc) {
        return jsonError(
          "Connect WordPress credentials first (Application Password)",
          400
        );
      }

      await prisma.websiteSettings.update({
        where: { websiteId: id },
        data: {
          publishMode: PublishMode.FULL_AUTOPILOT,
          autopilotEnabled: true,
        },
      });

      await syncGsc(id, { source: "workflow_autopilot" }).catch(() => undefined);
      const analysis = await analyzeSiteAndKeywords(id);
      const article = await researchAndGenerate(id, {
        forceInternalLinks: true,
        forcePublish: true,
        autoWordpress: true,
      });

      return jsonOk({
        step: "autopilot",
        ...analysis,
        article,
        seo: article && typeof article === "object" && "seo" in article
          ? (article as { seo: unknown }).seo
          : undefined,
      });
    }

    return jsonError("action must be analyze | write | full | autopilot");
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : String(e), 500);
  }
}

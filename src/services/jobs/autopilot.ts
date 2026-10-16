import { JobType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/queue";
import { isEmergencyStopped } from "@/lib/emergency";

export async function runAutopilotPipeline(websiteId: string) {
  if (await isEmergencyStopped()) {
    return { skipped: true, reason: "emergency_stop" };
  }

  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: { settings: true },
  });
  if (!website?.settings?.autopilotEnabled) {
    return { skipped: true, reason: "autopilot_disabled" };
  }

  const steps = [
    JobType.SYNC_GSC,
    JobType.CRAWL_SEO_AUDIT,
    JobType.DISCOVER_TOPICS,
    JobType.GENERATE_ARTICLE,
    JobType.MONITOR_GSC_FEEDBACK,
  ];

  const enqueued = [];
  for (const type of steps) {
    const job = await enqueueJob({
      type,
      websiteId,
      payload: { source: "autopilot", at: new Date().toISOString() },
    });
    enqueued.push({ type, jobId: job.id });
  }

  return { enqueued };
}

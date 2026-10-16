import { JobStatus, JobType } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { acquireJobLock, releaseJobLock } from "@/lib/queue";
import { isEmergencyStopped } from "@/lib/emergency";
import { syncGsc } from "@/services/gsc/sync";
import { crawlSeoAudit } from "@/services/seo/audit";
import { discoverTopics } from "@/services/seo/topics";
import { researchAndGenerate } from "@/services/articles/pipeline";
import { publishArticle } from "@/services/publish/service";
import { monitorGscFeedback } from "@/services/seo/feedback";
import { generateMonthlyReport } from "@/services/analytics/report";
import { recoverStaleJobs } from "@/lib/queue";
import { runAutopilotPipeline } from "@/services/jobs/autopilot";

export async function runJobById(jobId: string) {
  if (await isEmergencyStopped()) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
        lastError: "Emergency stop active",
        finishedAt: new Date(),
      },
    });
    return { cancelled: true };
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { error: "not_found" };
  if (job.status === JobStatus.SUCCEEDED) return { skipped: true };

  const owner = nanoid();
  const lockKey = `job:${job.id}`;
  const locked = await acquireJobLock(lockKey, owner);
  if (!locked) return { skipped: true, reason: "locked" };

  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: JobStatus.RUNNING,
      attempts: job.attempts + 1,
      startedAt: new Date(),
      lockedBy: owner,
      lockUntil: new Date(Date.now() + 120_000),
    },
  });

  await prisma.jobLog.create({
    data: { jobId: job.id, message: `Running attempt ${job.attempts + 1}` },
  });

  try {
    const payload = JSON.parse(job.payloadJson) as Record<string, unknown>;
    let result: unknown = null;

    switch (job.type) {
      case JobType.SYNC_GSC:
        result = await syncGsc(job.websiteId!, payload);
        break;
      case JobType.CRAWL_SEO_AUDIT:
        result = await crawlSeoAudit(job.websiteId!);
        break;
      case JobType.DISCOVER_TOPICS:
        result = await discoverTopics(job.websiteId!);
        break;
      case JobType.RESEARCH_TOPIC:
      case JobType.GENERATE_ARTICLE:
      case JobType.GENERATE_IMAGE:
      case JobType.QUALITY_CHECK:
        result = await researchAndGenerate(job.websiteId!, payload);
        break;
      case JobType.PUBLISH_ARTICLE:
      case JobType.VERIFY_PUBLICATION:
        result = await publishArticle(String(payload.articleId), {
          verify: job.type === JobType.VERIFY_PUBLICATION || Boolean(payload.verify),
        });
        break;
      case JobType.MONITOR_GSC_FEEDBACK:
        result = await monitorGscFeedback(job.websiteId!);
        break;
      case JobType.MONTHLY_REPORT:
        result = await generateMonthlyReport(job.websiteId!);
        break;
      case JobType.STALE_JOB_RECOVERY:
        result = { recovered: await recoverStaleJobs() };
        break;
      case JobType.AUTOPILOT_PIPELINE:
        result = await runAutopilotPipeline(job.websiteId!);
        break;
      default:
        throw new Error(`Unhandled job type: ${job.type}`);
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.SUCCEEDED,
        resultJson: JSON.stringify(result ?? {}),
        finishedAt: new Date(),
        lockUntil: null,
        lockedBy: null,
      },
    });
    await prisma.jobLog.create({
      data: { jobId: job.id, message: "Succeeded", level: "info" },
    });
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed =
      job.attempts + 1 >= job.maxAttempts ? JobStatus.FAILED : JobStatus.QUEUED;
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: failed,
        lastError: message,
        finishedAt: failed === JobStatus.FAILED ? new Date() : null,
        lockUntil: null,
        lockedBy: null,
      },
    });
    await prisma.jobLog.create({
      data: { jobId: job.id, message, level: "error" },
    });
    return { error: message };
  } finally {
    await releaseJobLock(lockKey, owner);
  }
}

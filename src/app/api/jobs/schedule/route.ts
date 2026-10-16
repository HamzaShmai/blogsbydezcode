import { JobType } from "@prisma/client";
import { Receiver } from "@upstash/qstash";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/queue";
import { jsonError, jsonOk } from "@/lib/api";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function authorizeSchedule(req: Request, bodyText: string): Promise<boolean> {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (current && next) {
    const receiver = new Receiver({
      currentSigningKey: current,
      nextSigningKey: next,
    });
    const signature = req.headers.get("upstash-signature") || "";
    return receiver.verify({ signature, body: bodyText });
  }

  if (process.env.NODE_ENV === "production") return false;

  const internal = process.env.INTERNAL_JOB_SECRET;
  if (internal && internal.length >= 32) {
    const provided = req.headers.get("x-internal-job-secret") || "";
    return safeEqual(provided, internal);
  }
  return process.env.JOBS_INLINE === "true";
}

/**
 * Cloud cron entrypoint. Must be signed (QStash) in production.
 */
export async function POST(req: Request) {
  const bodyText = await req.text();
  if (!(await authorizeSchedule(req, bodyText))) {
    return jsonError("Unauthorized", 401);
  }

  const body = bodyText ? (JSON.parse(bodyText) as { type?: string }) : {};
  const enqueued: string[] = [];

  if (!body.type || body.type === "STALE_JOB_RECOVERY") {
    const job = await enqueueJob({
      type: JobType.STALE_JOB_RECOVERY,
      payload: { at: new Date().toISOString() },
    });
    enqueued.push(job.id);
  }

  const sites = await prisma.website.findMany({
    where: { settings: { autopilotEnabled: true } },
    select: { id: true },
  });

  for (const site of sites) {
    const jobs = [
      JobType.SYNC_GSC,
      JobType.CRAWL_SEO_AUDIT,
      JobType.DISCOVER_TOPICS,
      JobType.MONITOR_GSC_FEEDBACK,
    ];
    for (const type of jobs) {
      if (body.type && body.type !== type && body.type !== "AUTOPILOT") continue;
      try {
        const job = await enqueueJob({
          type,
          websiteId: site.id,
          payload: { source: "schedule", at: new Date().toISOString() },
        });
        enqueued.push(job.id);
      } catch {
        // emergency stop or idempotent skip
      }
    }
  }

  return jsonOk({ enqueued: enqueued.length });
}

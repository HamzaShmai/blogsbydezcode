import { createHash } from "crypto";
import { JobStatus, JobType, Prisma } from "@prisma/client";
import { Client } from "@upstash/qstash";
import { prisma } from "@/lib/db";
import { isEmergencyStopped } from "@/lib/emergency";

function qstash(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token });
}

export function makeIdempotencyKey(type: JobType, websiteId: string | null, payload: unknown) {
  const hash = createHash("sha256")
    .update(JSON.stringify({ type, websiteId, payload }))
    .digest("hex")
    .slice(0, 32);
  return `${type}:${websiteId ?? "global"}:${hash}`;
}

export async function enqueueJob(input: {
  type: JobType;
  websiteId?: string | null;
  payload?: Record<string, unknown>;
  scheduledFor?: Date;
  maxAttempts?: number;
  delaySeconds?: number;
}) {
  if (await isEmergencyStopped()) {
    throw new Error("Emergency stop is active — jobs are not accepted");
  }

  const payload = input.payload ?? {};
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const idempotencyKey = makeIdempotencyKey(
    input.type,
    input.websiteId ?? null,
    payload
  );

  const existing = await prisma.job.findUnique({ where: { idempotencyKey } });
  if (
    existing &&
    (existing.status === JobStatus.PENDING ||
      existing.status === JobStatus.QUEUED ||
      existing.status === JobStatus.RUNNING ||
      existing.status === JobStatus.SUCCEEDED)
  ) {
    return existing;
  }

  const job = await prisma.job.create({
    data: {
      type: input.type,
      websiteId: input.websiteId ?? undefined,
      payloadJson: JSON.stringify(payload),
      payloadHash,
      idempotencyKey,
      maxAttempts: input.maxAttempts ?? 5,
      scheduledFor: input.scheduledFor,
      status: JobStatus.QUEUED,
    },
  });

  await prisma.jobLog.create({
    data: { jobId: job.id, message: `Enqueued ${job.type}`, level: "info" },
  });

  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const client = qstash();

  if (client) {
    await client.publishJSON({
      url: `${baseUrl}/api/jobs/worker`,
      body: { jobId: job.id },
      delay: input.delaySeconds,
      headers: { "Upstash-Deduplication-Id": idempotencyKey },
    });
  } else if (
    process.env.NODE_ENV !== "production" &&
    (process.env.JOBS_INLINE === "true" || process.env.NODE_ENV === "test")
  ) {
    // Local/dev only — never inline-execute jobs in production
    setTimeout(() => {
      import("@/services/jobs/runner").then(({ runJobById }) => {
        void runJobById(job.id);
      });
    }, (input.delaySeconds ?? 0) * 1000);
  } else if (process.env.NODE_ENV === "production" && !client) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        lastError: "QSTASH_TOKEN required in production",
        finishedAt: new Date(),
      },
    });
    throw new Error("QSTASH_TOKEN required in production");
  }

  return job;
}

export async function acquireJobLock(lockKey: string, owner: string, ttlMs = 120_000) {
  const expiresAt = new Date(Date.now() + ttlMs);
  try {
    await prisma.jobLock.create({ data: { lockKey, owner, expiresAt } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.jobLock.findUnique({ where: { lockKey } });
      if (existing && existing.expiresAt < new Date()) {
        await prisma.jobLock.delete({ where: { lockKey } });
        await prisma.jobLock.create({ data: { lockKey, owner, expiresAt } });
        return true;
      }
      return false;
    }
    throw e;
  }
}

export async function releaseJobLock(lockKey: string, owner: string) {
  await prisma.jobLock.deleteMany({ where: { lockKey, owner } });
}

export async function recoverStaleJobs() {
  const now = new Date();
  const stale = await prisma.job.findMany({
    where: {
      status: JobStatus.RUNNING,
      lockUntil: { lt: now },
    },
  });

  for (const job of stale) {
    const nextAttempts = job.attempts + 1;
    if (nextAttempts >= job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.STALE,
          lastError: "Stale lock recovered — max attempts exceeded",
          finishedAt: now,
        },
      });
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.QUEUED,
          attempts: nextAttempts,
          lockUntil: null,
          lockedBy: null,
          lastError: "Stale lock recovered — requeued",
        },
      });
      await enqueueJob({
        type: job.type,
        websiteId: job.websiteId,
        payload: { ...(JSON.parse(job.payloadJson) as object), _retryOf: job.id },
        delaySeconds: Math.min(60 * nextAttempts, 600),
      }).catch(() => undefined);
    }
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        level: "warn",
        message: "Stale job recovery",
      },
    });
  }

  return stale.length;
}

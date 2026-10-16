import { NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import { createHmac, timingSafeEqual } from "crypto";
import { runJobById } from "@/services/jobs/runner";
import { jsonError, jsonOk } from "@/lib/api";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function authorizeWorker(req: NextRequest, body: string): Promise<boolean> {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (current && next) {
    const receiver = new Receiver({
      currentSigningKey: current,
      nextSigningKey: next,
    });
    const signature = req.headers.get("upstash-signature") || "";
    return receiver.verify({ signature, body });
  }

  // Production must use QStash signatures — never open the worker
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  // Local/dev only: shared INTERNAL_JOB_SECRET header
  const internal = process.env.INTERNAL_JOB_SECRET;
  if (!internal || internal.length < 32) {
    // Allow unsigned only when explicitly opted-in for local inline jobs
    return process.env.JOBS_INLINE === "true";
  }

  const provided = req.headers.get("x-internal-job-secret") || "";
  const expected = createHmac("sha256", internal).update("worker").digest("hex");
  const providedMac = createHmac("sha256", internal).update("worker").digest("hex");
  // Accept either raw secret or hmac form
  return safeEqual(provided, internal) || safeEqual(provided, expected) || safeEqual(provided, providedMac);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const ok = await authorizeWorker(req, body);
  if (!ok) return jsonError("Unauthorized worker request", 401);

  let jobId: string | undefined;
  try {
    const parsed = JSON.parse(body) as { jobId?: string };
    jobId = parsed.jobId;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  if (!jobId || !/^[a-z0-9_-]{8,64}$/i.test(jobId)) {
    return jsonError("Invalid jobId", 400);
  }

  const result = await runJobById(jobId);
  // Do not leak full stack traces or decrypted credentials from job results
  return jsonOk({ ok: true, result });
}

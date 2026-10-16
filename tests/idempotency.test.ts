import { describe, expect, it } from "vitest";
import { JobType } from "@prisma/client";
import { makeIdempotencyKey } from "@/lib/queue";

describe("makeIdempotencyKey", () => {
  it("is stable for identical payloads", () => {
    const a = makeIdempotencyKey(JobType.SYNC_GSC, "site1", { x: 1 });
    const b = makeIdempotencyKey(JobType.SYNC_GSC, "site1", { x: 1 });
    expect(a).toBe(b);
  });

  it("changes when payload changes", () => {
    const a = makeIdempotencyKey(JobType.SYNC_GSC, "site1", { x: 1 });
    const b = makeIdempotencyKey(JobType.SYNC_GSC, "site1", { x: 2 });
    expect(a).not.toBe(b);
  });
});

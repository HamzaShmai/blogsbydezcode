import { describe, expect, it } from "vitest";
import { encryptJson, decryptJson, contentHash } from "@/lib/crypto";

describe("crypto", () => {
  it("round-trips credentials", () => {
    const payload = { username: "admin", applicationPassword: "secret" };
    const enc = encryptJson(payload);
    expect(enc).not.toContain("secret");
    expect(decryptJson(enc)).toEqual(payload);
  });

  it("hashes content stably", () => {
    expect(contentHash("Title", "Body")).toBe(contentHash("Title", "Body"));
    expect(contentHash("Title", "Body")).not.toBe(contentHash("Title", "Other"));
  });
});

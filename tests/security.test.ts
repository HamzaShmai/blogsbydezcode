import { describe, expect, it } from "vitest";
import { sanitizeForClient, validatePassword } from "@/lib/security";

describe("sanitizeForClient", () => {
  it("strips credential ciphertext and password hashes", () => {
    const raw = {
      id: "w1",
      name: "Acme",
      credentialsEnc: "CIPHERTEXT",
      gscTokensEnc: "TOKENS",
      passwordHash: "$2a$...",
      nested: { accessToken: "secret", title: "ok" },
      user: { email: "a@b.c", passwordHash: "x" },
    };
    const clean = sanitizeForClient(raw) as Record<string, unknown>;
    expect(clean.credentialsEnc).toBeUndefined();
    expect(clean.gscTokensEnc).toBeUndefined();
    expect(clean.passwordHash).toBeUndefined();
    expect(clean.hasCredentials).toBe(true);
    expect(clean.hasGsc).toBe(true);
    expect((clean.nested as Record<string, unknown>).accessToken).toBeUndefined();
    expect((clean.nested as Record<string, unknown>).title).toBe("ok");
    expect((clean.user as Record<string, unknown>).passwordHash).toBeUndefined();
    expect((clean.user as Record<string, unknown>).email).toBe("a@b.c");
  });
});

describe("validatePassword", () => {
  it("rejects weak passwords", () => {
    expect(validatePassword("password123")).toBeTruthy();
    expect(validatePassword("Short1!")).toBeTruthy();
  });
  it("accepts strong passwords", () => {
    expect(validatePassword("Str0ng-Passw0rd!")).toBeNull();
  });
});

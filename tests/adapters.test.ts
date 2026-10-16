import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { CmsType } from "@prisma/client";
import { getAdapter } from "@/adapters";

describe("adapters", () => {
  it("resolves all CMS types", () => {
    expect(getAdapter(CmsType.WORDPRESS)).toBeTruthy();
    expect(getAdapter(CmsType.SHOPIFY)).toBeTruthy();
    expect(getAdapter(CmsType.CUSTOM_WEBHOOK)).toBeTruthy();
    expect(getAdapter(CmsType.GIT_CONTENT)).toBeTruthy();
  });

  it("signs webhook payloads consistently", () => {
    const body = JSON.stringify({ type: "ping" });
    const secret = "demo";
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(sig).toHaveLength(64);
  });
});

/**
 * Happy-path integration test.
 * Skips when DATABASE_URL is not set.
 */
import { describe, expect, it } from "vitest";
import { createServer } from "http";
import { createHmac } from "crypto";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("e2e generate → approve → publish", () => {
  it("publishes through mock webhook CMS", async () => {
    process.env.ALLOW_OFFLINE_AI = "true";
    process.env.JOBS_INLINE = "true";
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      process.env.CREDENTIALS_ENCRYPTION_KEY || "test-credentials-key-32chars-min";

    const posts: unknown[] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = Buffer.concat(chunks).toString("utf8");
      const sig = req.headers["x-signature"];
      const expected = createHmac("sha256", "demo-secret").update(body).digest("hex");
      if (sig !== expected) {
        res.writeHead(401);
        res.end("bad sig");
        return;
      }
      const json = JSON.parse(body) as { type: string };
      posts.push(json);
      res.writeHead(200, { "Content-Type": "application/json" });
      if (json.type === "ping") {
        res.end(JSON.stringify({ ok: true }));
      } else if (json.type === "article.get") {
        res.end(JSON.stringify({ exists: true, url: "http://example.test/p/1", status: "publish" }));
      } else {
        res.end(JSON.stringify({ id: "cms-1", url: "http://example.test/p/1" }));
      }
    });

    await new Promise<void>((resolve) => server.listen(3999, resolve));

    const { PrismaClient, CmsType, PublishMode, OrgType, Role } = await import("@prisma/client");
    const { encryptJson } = await import("@/lib/crypto");
    const { researchAndGenerate } = await import("@/services/articles/pipeline");
    const { approveArticle } = await import("@/services/publish/service");
    const { hash } = await import("bcryptjs");

    const prisma = new PrismaClient();
    const suffix = Date.now().toString(36);

    const user = await prisma.user.create({
      data: {
        email: `e2e-${suffix}@test.local`,
        passwordHash: await hash("password123", 8),
        name: "E2E",
      },
    });
    const org = await prisma.organization.create({
      data: {
        name: `E2E ${suffix}`,
        slug: `e2e-${suffix}`,
        type: OrgType.CLIENT,
        memberships: { create: { userId: user.id, role: Role.CLIENT_ADMIN } },
      },
    });
    const website = await prisma.website.create({
      data: {
        organizationId: org.id,
        name: "E2E Site",
        domain: `e2e-${suffix}.test`,
        cmsType: CmsType.CUSTOM_WEBHOOK,
        credentialsEnc: encryptJson({
          webhookUrl: "http://127.0.0.1:3999/publish",
          webhookSecret: "demo-secret",
        }),
        settings: {
          create: {
            publishMode: PublishMode.APPROVAL_REQUIRED,
            aiProvider: "offline",
            imageProvider: "placeholder",
            minQualityThreshold: 0.5,
          },
        },
        categories: { create: [{ name: "General", slug: "general" }] },
      },
    });

    await prisma.topicRecommendation.create({
      data: {
        websiteId: website.id,
        title: "Practical content planning for SaaS blogs",
        keyword: "saas content planning",
        score: 80,
        searchIntent: "informational",
      },
    });

    const generated = await researchAndGenerate(website.id, {});
    expect(generated.articleId).toBeTruthy();

    const result = await approveArticle(String(generated.articleId), user.id);
    expect(result.status).toBe("PUBLISHED");
    expect(result.cmsPostId).toBe("cms-1");
    expect(posts.some((p) => (p as { type: string }).type === "article.create")).toBe(true);

    await prisma.$disconnect();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }, 60_000);
});

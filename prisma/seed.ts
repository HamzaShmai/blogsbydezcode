import "dotenv/config";
import { PrismaClient, CmsType, PublishMode, Role, OrgType } from "@prisma/client";
import { hash } from "bcryptjs";
import { encryptJson } from "../src/lib/crypto";
import { resolveDefaultAiProvider } from "../src/services/ai/provider";

const prisma = new PrismaClient();

async function main() {
  const existingStop = await prisma.emergencyStop.findFirst();
  if (!existingStop) {
    await prisma.emergencyStop.create({
      data: { active: false, reason: "Seed default" },
    });
  }

  const passwordHash = await hash("password123", 10);

  const agencyUser = await prisma.user.upsert({
    where: { email: "agency@pulserank.local" },
    update: {},
    create: {
      email: "agency@pulserank.local",
      name: "Agency Admin",
      passwordHash,
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: "client@acme.local" },
    update: {},
    create: {
      email: "client@acme.local",
      name: "Acme Client",
      passwordHash,
    },
  });

  const agency = await prisma.organization.upsert({
    where: { slug: "pulserank-agency" },
    update: {},
    create: {
      name: "PulseRank Agency",
      slug: "pulserank-agency",
      type: OrgType.AGENCY,
    },
  });

  const clientOrg = await prisma.organization.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme-corp",
      type: OrgType.CLIENT,
      agencyId: agency.id,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: { userId: agencyUser.id, organizationId: agency.id },
    },
    update: { role: Role.AGENCY_ADMIN },
    create: {
      userId: agencyUser.id,
      organizationId: agency.id,
      role: Role.AGENCY_ADMIN,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: { userId: clientUser.id, organizationId: clientOrg.id },
    },
    update: { role: Role.CLIENT_ADMIN },
    create: {
      userId: clientUser.id,
      organizationId: clientOrg.id,
      role: Role.CLIENT_ADMIN,
    },
  });

  // Agency can also access client org as member for convenience in demos
  await prisma.membership.upsert({
    where: {
      userId_organizationId: { userId: agencyUser.id, organizationId: clientOrg.id },
    },
    update: {},
    create: {
      userId: agencyUser.id,
      organizationId: clientOrg.id,
      role: Role.AGENCY_MEMBER,
    },
  });

  const website = await prisma.website.upsert({
    where: {
      organizationId_domain: {
        organizationId: clientOrg.id,
        domain: "demo.acme.test",
      },
    },
    update: {},
    create: {
      organizationId: clientOrg.id,
      name: "Acme Demo Blog",
      domain: "demo.acme.test",
      cmsType: CmsType.CUSTOM_WEBHOOK,
      credentialsEnc: encryptJson({
        webhookUrl: process.env.DEMO_WEBHOOK_URL || "http://127.0.0.1:3999/publish",
        webhookSecret: "demo-secret",
      }),
      settings: {
        create: {
          autopilotEnabled: false,
          publishMode: PublishMode.APPROVAL_REQUIRED,
          dailyPublishLimit: 2,
          weeklyPublishLimit: 7,
          timezone: "UTC",
          aiProvider: resolveDefaultAiProvider(),
          imageProvider: "placeholder",
          maxUsageBudgetUsd: 5,
          minQualityThreshold: 0.6,
        },
      },
      categories: {
        create: [
          { name: "SEO", slug: "seo" },
          { name: "Content", slug: "content" },
        ],
      },
    },
  });

  await prisma.gscSnapshot.upsert({
    where: {
      websiteId_date: {
        websiteId: website.id,
        date: new Date(new Date().toISOString().slice(0, 10)),
      },
    },
    update: {},
    create: {
      websiteId: website.id,
      date: new Date(new Date().toISOString().slice(0, 10)),
      clicks: 42,
      impressions: 1200,
      ctr: 0.035,
      position: 18.2,
    },
  });

  const queryCount = await prisma.gscQuery.count({ where: { websiteId: website.id } });
  if (queryCount === 0) {
    await prisma.gscQuery.createMany({
      data: [
        {
          websiteId: website.id,
          query: "acme content strategy",
          clicks: 12,
          impressions: 400,
          ctr: 0.03,
          position: 14,
          periodStart: new Date(Date.now() - 28 * 86400000),
          periodEnd: new Date(),
        },
        {
          websiteId: website.id,
          query: "technical seo checklist",
          clicks: 8,
          impressions: 900,
          ctr: 0.009,
          position: 22,
          periodStart: new Date(Date.now() - 28 * 86400000),
          periodEnd: new Date(),
        },
      ],
    });
  }

  console.log("Seed complete");
  console.log("Agency: agency@pulserank.local / password123");
  console.log("Client: client@acme.local / password123");
  console.log("Website:", website.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

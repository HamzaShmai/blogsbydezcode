import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canAccessWebsite, canWriteWebsite } from "@/lib/rbac";
import { encryptJson } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import type { CmsCredentials } from "@/adapters";
import { CmsType, PublishMode } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canAccessWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }
  const website = await prisma.website.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      name: true,
      domain: true,
      cmsType: true,
      gscProperty: true,
      createdAt: true,
      updatedAt: true,
      credentialsEnc: true,
      gscTokensEnc: true,
      settings: true,
      categories: true,
      organization: { select: { id: true, name: true, slug: true, type: true } },
    },
  });
  if (!website) return jsonError("Not found", 404);
  return jsonOk(website);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  if (!(await canWriteWebsite(session!.user.id, id))) {
    return jsonError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    name?: string;
    domain?: string;
    cmsType?: CmsType;
    gscProperty?: string;
    credentials?: CmsCredentials;
    settings?: {
      autopilotEnabled?: boolean;
      publishMode?: PublishMode;
      dailyPublishLimit?: number;
      weeklyPublishLimit?: number;
      timezone?: string;
      publishTimes?: string[];
      categoryIds?: string[];
      aiProvider?: string;
      imageProvider?: string;
      maxUsageBudgetUsd?: number;
      minQualityThreshold?: number;
      automaticTechnicalFixes?: boolean;
      notifyOnPublish?: boolean;
      notifyOnFailure?: boolean;
      gscSyncCron?: string;
      auditCron?: string;
      topicDiscoveryCron?: string;
    };
  };

  if (body.credentials) {
    for (const v of Object.values(body.credentials)) {
      if (typeof v === "string" && /NEXTAUTH_SECRET|DATABASE_URL|BEGIN PRIVATE/i.test(v)) {
        return jsonError("Invalid credential payload", 400);
      }
    }
  }

  const website = await prisma.website.update({
    where: { id },
    data: {
      name: body.name?.slice(0, 120),
      domain: body.domain?.slice(0, 255),
      cmsType: body.cmsType,
      gscProperty: body.gscProperty?.slice(0, 255),
      credentialsEnc: body.credentials ? encryptJson(body.credentials) : undefined,
      settings: body.settings
        ? {
            upsert: {
              create: { ...body.settings },
              update: body.settings,
            },
          }
        : undefined,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      domain: true,
      cmsType: true,
      credentialsEnc: true,
      settings: true,
      categories: true,
    },
  });

  await writeAuditLog({
    organizationId: website.organizationId,
    userId: session!.user.id,
    action: "website.update",
    entityType: "Website",
    entityId: id,
    meta: {
      settings: Boolean(body.settings),
      credentialsRotated: Boolean(body.credentials),
    },
  });

  return jsonOk(website);
}

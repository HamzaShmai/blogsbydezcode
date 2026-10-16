import { CmsType, PublishMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { getAccessibleWebsiteIds } from "@/lib/rbac";
import { encryptJson } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit";
import type { CmsCredentials } from "@/adapters";
import { resolveDefaultAiProvider } from "@/services/ai/provider";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const ids = await getAccessibleWebsiteIds(session!.user.id);
  const websites = await prisma.website.findMany({
    where: { id: { in: ids } },
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
      _count: { select: { articles: true, jobs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // sanitizeForClient strips Enc fields and adds hasCredentials/hasGsc
  return jsonOk({ websites });
}

export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = (await req.json()) as {
    organizationId: string;
    name: string;
    domain: string;
    cmsType: CmsType;
    credentials?: CmsCredentials;
    gscProperty?: string;
    settings?: {
      publishMode?: PublishMode;
      autopilotEnabled?: boolean;
      timezone?: string;
    };
  };

  if (!body.organizationId || !body.name || !body.domain || !body.cmsType) {
    return jsonError("organizationId, name, domain, cmsType required");
  }

  if (!Object.values(CmsType).includes(body.cmsType)) {
    return jsonError("Invalid cmsType");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session!.user.id,
      role: { in: ["AGENCY_ADMIN", "AGENCY_MEMBER", "CLIENT_ADMIN"] },
      OR: [
        { organizationId: body.organizationId },
        {
          organization: { clients: { some: { id: body.organizationId } } },
          role: { in: ["AGENCY_ADMIN", "AGENCY_MEMBER"] },
        },
      ],
    },
  });
  if (!membership) return jsonError("Forbidden", 403);

  // Never accept credential fields that look like env var names / dumps
  if (body.credentials) {
    for (const [k, v] of Object.entries(body.credentials)) {
      if (typeof v === "string" && /NEXTAUTH_SECRET|DATABASE_URL|BEGIN PRIVATE/i.test(v)) {
        return jsonError("Invalid credential payload", 400);
      }
      if (k.length > 64) return jsonError("Invalid credential key", 400);
    }
  }

  const website = await prisma.website.create({
    data: {
      organizationId: body.organizationId,
      name: body.name.slice(0, 120),
      domain: body.domain.slice(0, 255),
      cmsType: body.cmsType,
      gscProperty: body.gscProperty?.slice(0, 255),
      credentialsEnc: body.credentials ? encryptJson(body.credentials) : undefined,
      settings: {
        create: {
          publishMode: body.settings?.publishMode ?? PublishMode.FULL_AUTOPILOT,
          autopilotEnabled: body.settings?.autopilotEnabled ?? false,
          timezone: body.settings?.timezone ?? "UTC",
          aiProvider: resolveDefaultAiProvider(),
          imageProvider: process.env.OPENAI_API_KEY ? "openai" : "placeholder",
        },
      },
      categories: {
        create: [
          { name: "General", slug: "general" },
          { name: "Guides", slug: "guides" },
        ],
      },
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      domain: true,
      cmsType: true,
      createdAt: true,
      credentialsEnc: true,
      settings: true,
      categories: true,
    },
  });

  await writeAuditLog({
    organizationId: body.organizationId,
    userId: session!.user.id,
    action: "website.create",
    entityType: "Website",
    entityId: website.id,
  });

  return jsonOk(website, 201);
}

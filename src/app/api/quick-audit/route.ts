import { CmsType, PublishMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { analyzeSiteAndKeywords } from "@/services/seo/analyze-workflow";
import { researchAndGenerate } from "@/services/articles/pipeline";
import { resolveDefaultAiProvider } from "@/services/ai/provider";

/**
 * Free path: paste a site URL → audit issues + keyword gaps + optional blog draft.
 * No CMS credentials required (drafts stay in PulseRank until you connect publishing).
 */
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = (await req.json()) as {
    organizationId: string;
    domain: string;
    name?: string;
    writeBlog?: boolean;
  };

  if (!body.organizationId || !body.domain) {
    return jsonError("organizationId and domain required");
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

  const domain = body.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const name = (body.name || domain).slice(0, 120);

  let website = await prisma.website.findFirst({
    where: { organizationId: body.organizationId, domain },
  });

  if (!website) {
    website = await prisma.website.create({
      data: {
        organizationId: body.organizationId,
        name,
        domain,
        cmsType: CmsType.CUSTOM_WEBHOOK,
        settings: {
          create: {
            publishMode: PublishMode.DRAFT_ONLY,
            autopilotEnabled: false,
            aiProvider: resolveDefaultAiProvider(),
            imageProvider: "placeholder",
            minQualityThreshold: 0.55,
          },
        },
        categories: {
          create: [
            { name: "General", slug: "general" },
            { name: "Guides", slug: "guides" },
          ],
        },
      },
    });
  } else {
    await prisma.websiteSettings.update({
      where: { websiteId: website.id },
      data: { aiProvider: resolveDefaultAiProvider() },
    });
  }

  await writeAuditLog({
    organizationId: body.organizationId,
    userId: session!.user.id,
    action: "website.quick_audit",
    entityType: "Website",
    entityId: website.id,
  });

  const analysis = await analyzeSiteAndKeywords(website.id);
  let article: Awaited<ReturnType<typeof researchAndGenerate>> | null = null;
  if (body.writeBlog !== false) {
    article = await researchAndGenerate(website.id, { forceInternalLinks: true });
  }

  const latestAudit = await prisma.seoAudit.findFirst({
    where: { websiteId: website.id },
    orderBy: { startedAt: "desc" },
    include: { issues: { where: { resolved: false }, take: 30 } },
  });

  return jsonOk({
    websiteId: website.id,
    domain,
    aiProvider: resolveDefaultAiProvider(),
    analysis,
    issues: latestAudit?.issues ?? [],
    healthScore: latestAudit?.healthScore ?? null,
    article,
    note:
      "Audit + keyword gaps use free crawl/Google Suggest. Blogs use Grok when GROK_API_KEY is set. Publishing to the live site needs a CMS connection later.",
  });
}

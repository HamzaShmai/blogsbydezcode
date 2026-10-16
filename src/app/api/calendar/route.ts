import { prisma } from "@/lib/db";
import { requireSession, jsonOk } from "@/lib/api";
import { getAccessibleWebsiteIds } from "@/lib/rbac";

export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const ids = await getAccessibleWebsiteIds(session!.user.id);
  const websiteId = new URL(req.url).searchParams.get("websiteId");

  const articles = await prisma.article.findMany({
    where: {
      websiteId: websiteId && ids.includes(websiteId) ? websiteId : { in: ids },
      OR: [
        { scheduledAt: { not: null } },
        { publishedAt: { not: null } },
        { status: { in: ["SCHEDULED", "PENDING_APPROVAL", "PUBLISHED"] } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledAt: true,
      publishedAt: true,
      websiteId: true,
      website: { select: { name: true } },
    },
    orderBy: [{ scheduledAt: "asc" }, { publishedAt: "desc" }],
    take: 200,
  });

  return jsonOk({ events: articles });
}

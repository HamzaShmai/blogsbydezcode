import { OrgType, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { isAgencyRole } from "@/lib/rbac";
import { publicWebsiteSelect } from "@/lib/security";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const memberships = await prisma.membership.findMany({
    where: { userId: session!.user.id },
    include: {
      organization: {
        include: {
          websites: { select: publicWebsiteSelect() },
          clients: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              createdAt: true,
            },
          },
          _count: { select: { websites: true, memberships: true } },
        },
      },
    },
  });

  return jsonOk({
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      type: m.organization.type,
      agencyId: m.organization.agencyId,
      createdAt: m.organization.createdAt,
      websites: m.organization.websites,
      clients: m.organization.clients,
      _count: m.organization._count,
      role: m.role,
    })),
  });
}

export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = (await req.json()) as {
    name: string;
    slug: string;
    type: OrgType;
    agencyId?: string;
  };

  if (!body.name || !body.slug || !body.type) {
    return jsonError("name, slug, type required");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) {
    return jsonError("slug must be lowercase kebab-case");
  }

  const memberships = session!.user.memberships;
  if (body.type === OrgType.CLIENT) {
    const can = memberships.some(
      (m) =>
        isAgencyRole(m.role as Role) &&
        (!body.agencyId || m.organizationId === body.agencyId)
    );
    if (!can) return jsonError("Agency role required to create client org", 403);
  } else {
    const can = memberships.some((m) => m.role === Role.AGENCY_ADMIN);
    if (!can && memberships.length > 0) {
      return jsonError("Only agency admins can create agencies", 403);
    }
  }

  const org = await prisma.organization.create({
    data: {
      name: body.name.slice(0, 120),
      slug: body.slug.slice(0, 80),
      type: body.type,
      agencyId: body.type === OrgType.CLIENT ? body.agencyId : undefined,
      memberships: {
        create: {
          userId: session!.user.id,
          role:
            body.type === OrgType.AGENCY ? Role.AGENCY_ADMIN : Role.CLIENT_ADMIN,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      agencyId: true,
      createdAt: true,
    },
  });

  await writeAuditLog({
    organizationId: org.id,
    userId: session!.user.id,
    action: "organization.create",
    entityType: "Organization",
    entityId: org.id,
  });

  return jsonOk(org, 201);
}

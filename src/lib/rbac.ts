import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
};

const AGENCY_ROLES: Role[] = [Role.AGENCY_ADMIN, Role.AGENCY_MEMBER];
const WRITE_ROLES: Role[] = [
  Role.AGENCY_ADMIN,
  Role.AGENCY_MEMBER,
  Role.CLIENT_ADMIN,
];

export async function getMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { organization: true },
  });
}

export async function getAccessibleWebsiteIds(userId: string): Promise<string[]> {
  const memberships = await getMemberships(userId);
  const orgIds = new Set<string>();

  for (const m of memberships) {
    orgIds.add(m.organizationId);
    if (AGENCY_ROLES.includes(m.role) && m.organization.type === "AGENCY") {
      const clients = await prisma.organization.findMany({
        where: { agencyId: m.organizationId },
        select: { id: true },
      });
      clients.forEach((c) => orgIds.add(c.id));
    }
  }

  const websites = await prisma.website.findMany({
    where: { organizationId: { in: [...orgIds] } },
    select: { id: true },
  });
  return websites.map((w) => w.id);
}

export async function canAccessWebsite(userId: string, websiteId: string): Promise<boolean> {
  const ids = await getAccessibleWebsiteIds(userId);
  return ids.includes(websiteId);
}

export async function requireWebsiteAccess(userId: string, websiteId: string) {
  const ok = await canAccessWebsite(userId, websiteId);
  if (!ok) throw new Error("Forbidden: website not accessible");
}

export async function canWriteWebsite(userId: string, websiteId: string): Promise<boolean> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!website) return false;

  const memberships = await getMemberships(userId);
  for (const m of memberships) {
    if (!WRITE_ROLES.includes(m.role)) continue;
    if (m.organizationId === website.organizationId) return true;
    if (
      AGENCY_ROLES.includes(m.role) &&
      m.organization.type === "AGENCY"
    ) {
      const org = await prisma.organization.findUnique({
        where: { id: website.organizationId },
      });
      if (org?.agencyId === m.organizationId) return true;
    }
  }
  return false;
}

export function isAgencyRole(role: Role) {
  return AGENCY_ROLES.includes(role);
}

export function isAdminRole(role: Role) {
  return role === Role.AGENCY_ADMIN || role === Role.CLIENT_ADMIN;
}

import { prisma } from "@/lib/db";
import { sanitizeForClient } from "@/lib/security";

export async function writeAuditLog(input: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: unknown;
}) {
  const safeMeta = input.meta ? sanitizeForClient(input.meta) : undefined;
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId ?? undefined,
      userId: input.userId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metaJson: safeMeta ? JSON.stringify(safeMeta) : undefined,
    },
  });
}

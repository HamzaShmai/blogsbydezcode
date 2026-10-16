import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export async function isEmergencyStopped(): Promise<boolean> {
  const row = await prisma.emergencyStop.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return Boolean(row?.active);
}

export async function setEmergencyStop(input: {
  active: boolean;
  reason?: string;
  userId?: string;
}) {
  const existing = await prisma.emergencyStop.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const row = existing
    ? await prisma.emergencyStop.update({
        where: { id: existing.id },
        data: {
          active: input.active,
          reason: input.reason,
          activatedBy: input.userId,
        },
      })
    : await prisma.emergencyStop.create({
        data: {
          active: input.active,
          reason: input.reason,
          activatedBy: input.userId,
        },
      });

  await writeAuditLog({
    userId: input.userId,
    action: input.active ? "emergency.stop.on" : "emergency.stop.off",
    entityType: "EmergencyStop",
    entityId: row.id,
    meta: { reason: input.reason },
  });

  return row;
}

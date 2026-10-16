import { Role } from "@prisma/client";
import { nanoid } from "nanoid";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { validatePassword } from "@/lib/security";

export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const body = (await req.json()) as {
    email: string;
    organizationId: string;
    role: Role;
  };

  if (!body.email || !body.organizationId || !body.role) {
    return jsonError("email, organizationId, role required");
  }
  if (!Object.values(Role).includes(body.role)) {
    return jsonError("Invalid role");
  }
  // Clients cannot invite agency admins
  if (
    (body.role === Role.AGENCY_ADMIN || body.role === Role.AGENCY_MEMBER) &&
    !session!.user.memberships.some((m) => m.role === Role.AGENCY_ADMIN)
  ) {
    return jsonError("Only agency admins can invite agency roles", 403);
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session!.user.id,
      organizationId: body.organizationId,
      role: { in: [Role.AGENCY_ADMIN, Role.CLIENT_ADMIN] },
    },
  });
  if (!membership) return jsonError("Admin role required", 403);

  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Invalid email");
  }

  const token = nanoid(48);
  const invite = await prisma.invite.create({
    data: {
      email,
      organizationId: body.organizationId,
      role: body.role,
      token,
      expiresAt: new Date(Date.now() + 48 * 3600000), // 48h
    },
  });

  await writeAuditLog({
    organizationId: body.organizationId,
    userId: session!.user.id,
    action: "invite.create",
    entityType: "Invite",
    entityId: invite.id,
    meta: { email, role: body.role },
  });

  // Return accept URL once — token is the secret capability
  return jsonOk({
    invite: { id: invite.id, email: invite.email, role: invite.role },
    acceptUrl: `${process.env.APP_URL || "http://localhost:3000"}/invite/${token}`,
  });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    token: string;
    name: string;
    password: string;
  };

  if (!body.token || body.token.length < 20) {
    return jsonError("Invalid or expired invite", 400);
  }

  const passwordError = validatePassword(body.password || "");
  if (passwordError) return jsonError(passwordError, 400);

  const name = (body.name || "").trim().slice(0, 80);
  if (name.length < 2) return jsonError("Name required");

  const invite = await prisma.invite.findUnique({ where: { token: body.token } });
  if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
    return jsonError("Invalid or expired invite", 400);
  }

  const passwordHash = await hash(body.password, 12);
  let user = await prisma.user.findUnique({ where: { email: invite.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: invite.email,
        name,
        passwordHash,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name, passwordHash },
    });
  }

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: invite.organizationId,
      },
    },
    create: {
      userId: user.id,
      organizationId: invite.organizationId,
      role: invite.role,
    },
    update: { role: invite.role },
  });

  await prisma.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await writeAuditLog({
    organizationId: invite.organizationId,
    userId: user.id,
    action: "invite.accept",
    entityType: "Invite",
    entityId: invite.id,
  });

  return jsonOk({ userId: user.id, email: user.email });
}

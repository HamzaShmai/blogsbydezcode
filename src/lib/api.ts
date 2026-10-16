import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { sanitizeForClient } from "@/lib/security";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

type SessionResult =
  | { session: Session; error?: undefined }
  | { session?: undefined; error: NextResponse };

export async function requireSession(): Promise<SessionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: jsonError("Unauthorized", 401) };
  }
  return { session };
}

export async function requireAgencyAdmin(): Promise<SessionResult> {
  const result = await requireSession();
  if (result.error) return result;
  const ok = result.session.user.memberships.some((m) => m.role === "AGENCY_ADMIN");
  if (!ok) return { error: jsonError("Agency admin required", 403) };
  return result;
}

export async function requireRole(roles: Role[]): Promise<SessionResult> {
  const result = await requireSession();
  if (result.error) return result;
  const ok = result.session.user.memberships.some((m) =>
    roles.includes(m.role as Role)
  );
  if (!ok) return { error: jsonError("Forbidden", 403) };
  return result;
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(sanitizeForClient(data), {
    status,
    headers: SECURITY_HEADERS,
  });
}

export function jsonError(message: string, status = 400) {
  const safe =
    status >= 500
      ? "Internal server error"
      : message.replace(
          /(password|token|secret|key|authorization)=[^\s&]+/gi,
          "$1=[redacted]"
        );
  return NextResponse.json(
    { error: safe },
    { status, headers: SECURITY_HEADERS }
  );
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_EXACT = new Set(["/api/gsc/callback", "/api/jobs/worker", "/api/jobs/schedule"]);

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  return res;
}

function isPublicApi(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/auth")) return true;
  if (PUBLIC_EXACT.has(path)) return true;
  if (path === "/api/invites" && req.method === "PUT") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/") && isPublicApi(req)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const needsAuth =
    path.startsWith("/agency") ||
    path.startsWith("/client") ||
    (path.startsWith("/api/") && !isPublicApi(req));

  if (!needsAuth) {
    return withSecurityHeaders(NextResponse.next());
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie:
      process.env.NEXTAUTH_URL?.startsWith("https://") ||
      process.env.NODE_ENV === "production",
  });

  if (!token?.sub) {
    if (path.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", path);
    return withSecurityHeaders(NextResponse.redirect(login));
  }

  // Role gate for portals
  const memberships = (token.memberships as { role: string }[]) || [];
  const isAgency = memberships.some(
    (m) => m.role === "AGENCY_ADMIN" || m.role === "AGENCY_MEMBER"
  );
  const isClient = memberships.some(
    (m) => m.role === "CLIENT_ADMIN" || m.role === "CLIENT_VIEWER"
  );

  if (path.startsWith("/agency") && !isAgency) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/client", req.url)));
  }
  if (path.startsWith("/client") && !isClient && !isAgency) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", req.url)));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/agency/:path*", "/client/:path*", "/api/:path*"],
};

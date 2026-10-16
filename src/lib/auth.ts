import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { assertSecureEnv } from "@/lib/security";

if (typeof window === "undefined") {
  try {
    assertSecureEnv();
  } catch (e) {
    if (process.env.NODE_ENV === "production") throw e;
    console.warn("[security]", e instanceof Error ? e.message : e);
  }
}

const useSecureCookies =
  process.env.NEXTAUTH_URL?.startsWith("https://") ||
  process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8 hours
    updateAge: 60 * 30,
  },
  jwt: {
    maxAge: 60 * 60 * 8,
  },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: useSecureCookies
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        // Constant-ish failure path: always hash compare when possible
        const email = credentials.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        // Dummy hash compare to reduce timing oracle when user missing
        const hash =
          user?.passwordHash ||
          "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012";
        const valid = await compare(credentials.password, hash);
        if (!user || !valid) {
          await writeAuditLog({
            action: "auth.login_failed",
            entityType: "User",
            meta: { email },
          });
          return null;
        }

        await writeAuditLog({
          userId: user.id,
          action: "auth.login",
          entityType: "User",
          entityId: user.id,
        });

        // Never return passwordHash or other secrets
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user || trigger === "update") {
        const userId = (user?.id || token.sub) as string;
        token.sub = userId;
        const memberships = await prisma.membership.findMany({
          where: { userId },
          include: { organization: { select: { type: true, slug: true, name: true } } },
        });
        token.memberships = memberships.map((m) => ({
          organizationId: m.organizationId,
          role: m.role,
          orgType: m.organization.type,
          orgSlug: m.organization.slug,
          orgName: m.organization.name,
        }));
      }
      // Never put secrets on the token
      delete (token as Record<string, unknown>).passwordHash;
      delete (token as Record<string, unknown>).credentialsEnc;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.memberships = (token.memberships as SessionMembership[]) ?? [];
        // Strip anything unexpected
        delete (session.user as Record<string, unknown>).passwordHash;
      }
      return session;
    },
  },
};

export type SessionMembership = {
  organizationId: string;
  role: string;
  orgType: string;
  orgSlug: string;
  orgName: string;
};

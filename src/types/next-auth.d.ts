import "next-auth";
import type { SessionMembership } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      memberships: SessionMembership[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    memberships?: SessionMembership[];
  }
}

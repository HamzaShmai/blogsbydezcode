import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return session;
}

export function primaryPortal(memberships: { role: string; orgType: string }[]) {
  const agency = memberships.some(
    (m) => m.role === "AGENCY_ADMIN" || m.role === "AGENCY_MEMBER"
  );
  return agency ? "/agency" : "/client";
}

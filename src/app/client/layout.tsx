import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  return (
    <AppShell portal="client" title="" userEmail={session.user.email}>
      {children}
    </AppShell>
  );
}

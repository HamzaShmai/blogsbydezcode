import { requireAgencyAdmin, jsonOk } from "@/lib/api";
import { isEmergencyStopped, setEmergencyStop } from "@/lib/emergency";

export async function GET() {
  const auth = await requireAgencyAdmin();
  if (auth.error) return auth.error;
  return jsonOk({ active: await isEmergencyStopped() });
}

export async function POST(req: Request) {
  const auth = await requireAgencyAdmin();
  if (auth.error) return auth.error;

  const body = (await req.json()) as { active: boolean; reason?: string };
  const row = await setEmergencyStop({
    active: Boolean(body.active),
    reason: body.reason?.slice(0, 500),
    userId: auth.session.user.id,
  });
  return jsonOk({
    id: row.id,
    active: row.active,
    reason: row.reason,
    updatedAt: row.updatedAt,
  });
}

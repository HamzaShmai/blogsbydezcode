import { requireSession, jsonError, jsonOk } from "@/lib/api";
import { canWriteWebsite } from "@/lib/rbac";
import { getGscAuthUrl } from "@/services/gsc/sync";

export async function GET(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  const websiteId = new URL(req.url).searchParams.get("websiteId");
  if (!websiteId) return jsonError("websiteId required");
  if (!(await canWriteWebsite(session!.user.id, websiteId))) {
    return jsonError("Forbidden", 403);
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return jsonError("GOOGLE_CLIENT_ID not configured", 503);
  }
  return jsonOk({ url: getGscAuthUrl(websiteId) });
}

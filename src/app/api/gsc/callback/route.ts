import { NextRequest, NextResponse } from "next/server";
import { storeGscTokens } from "@/services/gsc/sync";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const websiteId = req.nextUrl.searchParams.get("state");
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!code || !websiteId) {
    return NextResponse.redirect(`${appUrl}/agency/websites?gsc=error`);
  }

  try {
    await storeGscTokens(websiteId, code);
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    await writeAuditLog({
      organizationId: website?.organizationId,
      action: "gsc.connect",
      entityType: "Website",
      entityId: websiteId,
    });
    return NextResponse.redirect(`${appUrl}/agency/websites/${websiteId}?gsc=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl}/agency/websites/${websiteId}?gsc=error`);
  }
}

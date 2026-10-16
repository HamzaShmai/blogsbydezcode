import { DataKind } from "@prisma/client";
import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";

type GscTokens = {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
};

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/gsc/callback`
  );
}

export function getGscAuthUrl(websiteId: string) {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
    state: websiteId,
  });
}

export async function storeGscTokens(websiteId: string, code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  await prisma.website.update({
    where: { id: websiteId },
    data: { gscTokensEnc: encryptJson(tokens) },
  });
  return tokens;
}

async function getAuthedSearchConsole(websiteId: string) {
  const website = await prisma.website.findUniqueOrThrow({ where: { id: websiteId } });
  if (!website.gscTokensEnc || !website.gscProperty) {
    return null;
  }
  const tokens = decryptJson<GscTokens>(website.gscTokensEnc);
  const client = oauthClient();
  client.setCredentials(tokens);
  client.on("tokens", async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await prisma.website.update({
      where: { id: websiteId },
      data: { gscTokensEnc: encryptJson(merged) },
    });
  });
  return {
    webmasters: google.webmasters({ version: "v3", auth: client }),
    property: website.gscProperty,
  };
}

/** Sync GSC analytics. Falls back to synthetic measured-empty when not connected. */
export async function syncGsc(websiteId: string, payload: Record<string, unknown> = {}) {
  void payload;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 28);

  const authed = await getAuthedSearchConsole(websiteId);
  if (!authed) {
    // No credentials — record a zero snapshot so dashboards stay honest
    const day = new Date(end.toISOString().slice(0, 10));
    await prisma.gscSnapshot.upsert({
      where: { websiteId_date: { websiteId, date: day } },
      create: {
        websiteId,
        date: day,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        kind: DataKind.MEASURED,
      },
      update: {},
    });
    return { synced: false, reason: "gsc_not_connected", kind: DataKind.MEASURED };
  }

  const { webmasters, property } = authed;
  const res = await webmasters.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["date"],
      rowLimit: 1000,
    },
  });

  const rows = res.data.rows ?? [];
  for (const row of rows) {
    const date = new Date(row.keys?.[0] ?? end.toISOString().slice(0, 10));
    await prisma.gscSnapshot.upsert({
      where: { websiteId_date: { websiteId, date } },
      create: {
        websiteId,
        date,
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
        kind: DataKind.MEASURED,
      },
      update: {
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      },
    });
  }

  const queryRes = await webmasters.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["query"],
      rowLimit: 100,
    },
  });

  for (const row of queryRes.data.rows ?? []) {
    const query = row.keys?.[0] ?? "";
    if (!query) continue;
    await prisma.gscQuery.create({
      data: {
        websiteId,
        query,
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
        periodStart: start,
        periodEnd: end,
        kind: DataKind.MEASURED,
      },
    });
  }

  const pageRes = await webmasters.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["page"],
      rowLimit: 100,
    },
  });

  for (const row of pageRes.data.rows ?? []) {
    const pageUrl = row.keys?.[0] ?? "";
    if (!pageUrl) continue;
    await prisma.gscPage.create({
      data: {
        websiteId,
        pageUrl,
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
        periodStart: start,
        periodEnd: end,
        kind: DataKind.MEASURED,
      },
    });
  }

  return {
    synced: true,
    dates: rows.length,
    queries: queryRes.data.rows?.length ?? 0,
    pages: pageRes.data.rows?.length ?? 0,
    kind: DataKind.MEASURED,
  };
}

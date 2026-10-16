# Deployment

## Architecture on free-tier-first services

| Layer | Service | Notes |
| --- | --- | --- |
| Web + API + job handlers | Vercel | Hobby free tier; serverless cold starts |
| Postgres | Neon | Free project; scale-to-zero sleep |
| Queue / schedules | Upstash QStash | Free daily message quota |
| Optional cache/locks | Upstash Redis | Free tier; DB locks also work without Redis |
| Auth | Auth.js credentials | Self-hosted in app |
| GSC | Google Cloud OAuth | Free for Search Console API usage within Google quotas |
| AI / images | OpenAI / Anthropic | **Paid or limited trial — not unlimited free** |

Laptop-off operation: recurring QStash schedules call `/api/jobs/worker` on Vercel. Do not rely on a local `next dev` process for production jobs.

## 1. Database (Neon)

1. Create a Neon project.
2. Copy the pooled connection string into `DATABASE_URL`.
3. From the repo:

```bash
npx prisma migrate deploy
npm run db:seed
```

## 2. Upstash QStash

1. Create a QStash token and signing keys.
2. Set `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
3. Set `APP_URL` to your Vercel URL.
4. Set `JOBS_INLINE=false` in production.
5. Create schedules that POST to `https://YOUR_APP/api/jobs/worker` **or** use the in-app enqueue endpoints / autopilot jobs which publish through QStash.

Recommended schedules (per website or global recovery):

- Stale recovery: enqueue `STALE_JOB_RECOVERY` hourly
- Per-site GSC sync / audit / topic discovery according to `WebsiteSettings` cron fields

## 3. Vercel

1. Import the Git repository.
2. Add all variables from `.env.example`.
3. Build command: `prisma generate && next build`
4. Install command: `npm install`

Add to `package.json` (already present): `postinstall` → `prisma generate`.

## 4. Google Search Console OAuth

1. Create OAuth credentials in Google Cloud Console.
2. Authorized redirect URI: `https://YOUR_APP/api/gsc/callback`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
4. In the agency UI, open a website and click **Connect GSC**.

## 5. Secrets

- `NEXTAUTH_SECRET` — random 32+ chars
- `CREDENTIALS_ENCRYPTION_KEY` — random 32+ chars for AES-GCM CMS/GSC token encryption

## 6. Local development without QStash

```bash
cp .env.example .env
# set DATABASE_URL
npm install
npx prisma migrate dev
npm run db:seed
# JOBS_INLINE=true and ALLOW_OFFLINE_AI=true
npm run dev
```

Jobs run in-process via `setTimeout` when QStash is unset and `JOBS_INLINE=true`.

## 7. Smoke checklist

1. Login as `agency@pulserank.local`
2. Open demo website → Discover topics → Generate article
3. Approve & publish (configure a reachable webhook or WordPress credentials)
4. Login as `client@acme.local` and confirm only Acme data is visible
5. Toggle emergency stop and confirm enqueue fails

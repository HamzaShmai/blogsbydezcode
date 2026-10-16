# PulseRank — Unified AI SEO + Blog Publishing

One login for the agency, separate client portals, multiple connected websites, Search Console monitoring, research-driven article generation, image generation, scheduled publishing, and a GSC feedback loop for future recommendations (never ranking guarantees).

## Stack

- Next.js 15 (App Router) + Auth.js
- Prisma + PostgreSQL (Neon in production, Docker locally)
- Upstash QStash for cloud jobs (inline jobs for local/dev)
- WordPress, Shopify, custom webhook, and Git/MDX adapters

## Quick start

```bash
cp .env.example .env
docker compose up -d
# DATABASE_URL=postgresql://pulserank:pulserank@localhost:5432/pulserank
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Demo accounts (from seed):

- Agency: `agency@pulserank.local` / `password123`
- Client: `client@acme.local` / `password123`

With `JOBS_INLINE=true` and `ALLOW_OFFLINE_AI=true`, the full topic → article → approve pipeline works without OpenAI or QStash.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Next.js |
| `npm run build` | Production build |
| `npm test` | Vitest unit/integration tests |
| `npm run db:seed` | Seed agency, client, demo website |
| `npx prisma migrate deploy` | Apply migrations |

## Docs

- [Deployment](docs/DEPLOYMENT.md)
- [Free-tier limits](docs/FREE_TIER.md)
- [Publishing adapters](docs/PUBLISHING_ADAPTERS.md)

## Safety

- Modes: draft only · approval required · full autopilot
- Global emergency stop
- Encrypted CMS/GSC credentials
- Manual-edit protection, duplicate publish guards, verified issue resolution
- Measured analytics clearly separated from recommendations

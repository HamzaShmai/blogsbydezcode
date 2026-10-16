# Free-tier realities

This MVP prioritizes services with genuine free tiers for development and a small pilot. It does **not** promise unlimited free AI generation or uninterrupted background execution.

## What is free / freemium

| Dependency | Free tier behavior | Impact |
| --- | --- | --- |
| Neon Postgres | Storage/compute limits; projects may sleep | First request after sleep is slower |
| Vercel Hobby | Limited serverless execution time & bandwidth | Cold starts; long crawls should stay within limits |
| Upstash QStash | Daily message quota | Exceeding quota pauses autonomous schedules |
| Upstash Redis | Small free database | Optional; DB locks still function |
| Google Search Console API | Subject to Google quotas | Sync may throttle on large properties |
| Auth.js / app code | Free | — |

## What is paid or quota-limited

| Dependency | Notes |
| --- | --- |
| OpenAI / Anthropic chat | Required for high-quality generation; billed per token |
| OpenAI Images / other image APIs | Featured images cost money; placeholder SVG used when unset |
| Tavily / SerpAPI | Live research; without keys the app **does not invent sources** |
| Shopify / WordPress hosting | Customer’s CMS plan |
| GitHub Actions rebuild minutes | If using Git content adapter + CI rebuild |

## Offline / demo mode

With `ALLOW_OFFLINE_AI=true` and no AI keys, the generator produces structured demo articles and SVG placeholders. Suitable for UI/pipeline testing only.

## Background execution honesty

- Autonomous operation requires deployed cloud handlers (Vercel + QStash), not a closed laptop running `next dev`.
- Free QStash/Vercel quotas can delay or skip jobs.
- Neon sleep means occasional cold latency after idle periods.

## Budget controls

Each website has `maxUsageBudgetUsd`. AI/image calls record estimated usage and stop when the monthly estimate is exceeded.

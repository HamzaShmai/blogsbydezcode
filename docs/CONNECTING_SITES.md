# Connecting websites to PulseRank

PulseRank is **not** a browser extension and it does **not** “install into React.”
It connects to whatever can accept published posts + (optionally) Google Search Console.

## What every site needs

1. **Public URL / domain** — for technical SEO crawl  
2. **Publish adapter** — one of WordPress, Shopify, Git content, or custom webhook  
3. **(Recommended) Search Console property** — for measured traffic data  

## By stack

| Stack | Best adapter | What you prepare |
| --- | --- | --- |
| **Next.js / Astro** with MDX/Markdown | `GIT_CONTENT` | GitHub repo, write token, content folder, auto-deploy on push |
| **Next.js / React** with your own API/DB | `CUSTOM_WEBHOOK` | HTTPS endpoint + HMAC secret implementing create/update/get |
| **WordPress** (classic or headless) | `WORDPRESS` | Application Password + REST API |
| **Shopify** | `SHOPIFY` | Admin token + Blog ID |
| **React SPA only (no backend)** | — | Add a backend, Git content, or CMS — SPA alone cannot receive posts |

## Next.js example (Git)

1. Keep posts in `content/blog/*.mdx`  
2. In PulseRank → Websites → CMS = **Git content**  
3. Enter `githubRepo`, token, branch, `contentPath=content/blog`  
4. Ensure Vercel/Netlify rebuilds on commit  

## React / custom API example (Webhook)

Your server must verify `X-Signature: HMAC-SHA256(body, secret)` and handle:

- `ping` → `{ ok: true }`  
- `article.create` / `article.update` → `{ id, url }`  
- `article.get` → `{ exists, url, status }`  

Then point PulseRank’s `CUSTOM_WEBHOOK` credentials at that URL.

## SEO monitoring without publishing

You can still connect a domain + GSC for audits and topic ideas, and keep publish mode on **Draft only** until a CMS adapter is ready.

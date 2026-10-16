# Publishing adapters

Not every website accepts blog posts through the same API. PulseRank selects an adapter from `Website.cmsType`.

## Shared interface

```ts
testConnection(credentials)
createPost(credentials, input)
updatePost(credentials, cmsPostId, input)
getPost(credentials, cmsPostId)
verifyPublication(credentials, cmsPostId)
```

`input` includes title, slug, HTML + Markdown, excerpt, SEO title/description, tags, featured image URL/alt, and draft/publish status.

## WordPress (`WORDPRESS`)

- Auth: Application Passwords over HTTPS REST (`/wp-json/wp/v2/posts`)
- Credentials: `baseUrl`, `username`, `applicationPassword`
- Verification: fetch post by ID, then HEAD the public link

## Shopify (`SHOPIFY`)

- Auth: Admin API access token
- Credentials: `shopDomain`, `accessToken`, `blogId`
- Creates articles under the specified blog
- Verification: article exists and `published_at` is set

## Custom webhook (`CUSTOM_WEBHOOK`)

For proprietary CMS or middleware.

- Credentials: `webhookUrl`, `webhookSecret`
- Requests are JSON POSTs signed with `X-Signature: HMAC-SHA256(body)`
- Events: `ping`, `article.create`, `article.update`, `article.get`
- Response for create/update should include `{ "id": "...", "url": "..." }`

## Git content for Next.js / Astro (`GIT_CONTENT`)

Commits MDX/Markdown into a content collection path via the GitHub Contents API.

- Credentials: `githubToken`, `githubRepo` (`owner/repo`), `githubBranch`, `contentPath` (default `content/blog`)
- Front matter includes title, description, slug, date, draft, tags, image
- **Rebuild is out of band**: configure Vercel/Netlify deploy hooks or GitHub Actions on the content repo
- Verification confirms the commit SHA exists; public URL availability depends on the site’s build pipeline

### Example Next.js content collection path

```
content/blog/my-post.mdx
```

### Example Astro content collection

Point `contentPath` at `src/content/blog` (or your collection directory) and ensure the site rebuilds on push.

## Safety guarantees

- Duplicate publication protection via content hash + successful `PublicationAttempt` idempotency keys
- Draft-only / approval / full autopilot modes enforced before CMS writes
- Manual edits set `manuallyEditedAt` so autopilot will not silently overwrite
- Emergency stop blocks publish jobs globally

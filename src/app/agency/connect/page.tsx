import Link from "next/link";

const stacks = [
  {
    name: "Next.js / Astro (MDX or Markdown)",
    adapter: "GIT_CONTENT",
    needs: [
      "GitHub repo with a content folder (e.g. content/blog)",
      "Fine-grained GitHub token with Contents: write",
      "Branch name + content path",
      "Deploy hook / Vercel rebuild on push so posts go live",
    ],
    note: "PulseRank commits .mdx files. Your site must rebuild to publish publicly.",
  },
  {
    name: "React / Next custom CMS or API",
    adapter: "CUSTOM_WEBHOOK",
    needs: [
      "HTTPS endpoint that accepts signed JSON POSTs",
      "Shared webhook secret for HMAC-SHA256 (X-Signature)",
      "Handlers for ping, article.create, article.update, article.get",
      "Response with { id, url } after create/update",
    ],
    note: "Best when your app owns its own database/API for posts.",
  },
  {
    name: "WordPress",
    adapter: "WORDPRESS",
    needs: [
      "Site URL (HTTPS)",
      "WP username + Application Password",
      "REST API enabled (/wp-json/wp/v2/posts)",
    ],
    note: "Works with classic or headless WP as long as REST is open to that user.",
  },
  {
    name: "Shopify",
    adapter: "SHOPIFY",
    needs: [
      "Shop domain",
      "Admin API access token with write_content",
      "Blog ID for articles",
    ],
    note: "Publishes to Shopify Online Store blogs.",
  },
];

export default function ConnectGuidePage() {
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Integrations</p>
          <h1>Connect any website</h1>
          <p className="lede">
            PulseRank does not inject into React itself. It connects through a CMS API,
            a signed webhook, or Git content — plus optional Google Search Console.
          </p>
        </div>
        <Link className="btn" href="/agency/websites">
          Add a website
        </Link>
      </header>

      <section className="panel panel-rich">
        <h2>Always useful (any stack)</h2>
        <ul className="need-list">
          <li>
            <strong>Public domain</strong> — used for SEO crawl (https://yoursite.com)
          </li>
          <li>
            <strong>Google Search Console property</strong> — OAuth connect for measured
            clicks/impressions (optional but recommended)
          </li>
          <li>
            <strong>One publish path</strong> — WordPress, Shopify, Git/MDX, or your own
            webhook API
          </li>
        </ul>
      </section>

      <div className="connect-grid">
        {stacks.map((s) => (
          <article key={s.adapter} className="panel panel-rich">
            <p className="pill">{s.adapter}</p>
            <h2>{s.name}</h2>
            <ul className="need-list">
              {s.needs.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="muted">{s.note}</p>
          </article>
        ))}
      </div>

      <section className="panel panel-rich">
        <h2>Plain React SPA with no blog API?</h2>
        <p className="muted">
          A client-only React app cannot receive posts by itself. Add one of:
        </p>
        <ol className="pipeline">
          <li>A small backend route (Node/Express/Next API) that implements the webhook</li>
          <li>Move posts into MDX in a Git repo and use GIT_CONTENT</li>
          <li>Host content on WordPress/Shopify and keep React as the frontend</li>
        </ol>
        <p className="muted">
          Full payload details live in{" "}
          <code>docs/PUBLISHING_ADAPTERS.md</code>.
        </p>
      </section>
    </>
  );
}

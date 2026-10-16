import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="main" style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1>Documentation</h1>
      <p className="muted">
        Full markdown docs ship in the repository under <code>docs/</code>.
      </p>
      <section className="panel stack">
        <Link href="https://github.com/" aria-disabled>
          See README.md for local setup
        </Link>
        <p>
          <strong>DEPLOYMENT.md</strong> — Neon, Vercel, QStash, GSC OAuth
        </p>
        <p>
          <strong>FREE_TIER.md</strong> — quotas, sleep behavior, paid AI dependencies
        </p>
        <p>
          <strong>PUBLISHING_ADAPTERS.md</strong> — WordPress, Shopify, webhook, Git/MDX
        </p>
      </section>
      <Link className="btn secondary" href="/">
        Home
      </Link>
    </div>
  );
}

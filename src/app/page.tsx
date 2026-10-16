import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { primaryPortal } from "@/lib/session";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(primaryPortal(session.user.memberships));
  }

  return (
    <div className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <div className="gate-grid gate-grid-home">
        <section className="gate-brand">
          <p className="gate-kicker">PulseRank</p>
          <h1 className="gate-title">
            SEO that writes
            <br />
            the next post.
          </h1>
          <p className="gate-lede">
            Monitor Search Console, close technical gaps, and publish research-backed
            articles — on a schedule that runs without your laptop open.
          </p>
          <div className="gate-cta-row">
            <Link className="gate-submit" href="/login">
              Enter console
            </Link>
            <Link className="gate-ghost" href="/docs">
              Read the docs
            </Link>
          </div>
        </section>
        <aside className="gate-aside" aria-hidden>
          <div className="gate-meter">
            <span>GSC · measured</span>
            <strong>+18% CTR on refreshed titles</strong>
            <em>Sample workspace signal — not a promise</em>
          </div>
          <div className="gate-meter delay">
            <span>Pipeline</span>
            <strong>Topic → draft → approve → live</strong>
            <em>WordPress · Shopify · Git · webhook</em>
          </div>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Those credentials don’t match an account.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <div className="gate-grid">
        <section className="gate-brand">
          <p className="gate-kicker">PulseRank</p>
          <h1 className="gate-title">
            Rank signals in.
            <br />
            Stories out.
          </h1>
          <p className="gate-lede">
            One console for agencies and clients — Search Console, audits, and
            publication without the noise.
          </p>
          <ul className="gate-points">
            <li>Isolated client workspaces</li>
            <li>Approval or full autopilot</li>
            <li>Measured data, never ranking guarantees</li>
          </ul>
        </section>

        <section className="gate-panel">
          <form className="gate-form" onSubmit={onSubmit} autoComplete="on">
            <header className="gate-form-head">
              <h2>Welcome back</h2>
              <p>Sign in with your agency or client account.</p>
            </header>

            <label className="gate-field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="you@company.com"
              />
            </label>

            <label className="gate-field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                minLength={8}
                placeholder="••••••••"
              />
            </label>

            {error ? <p className="gate-error" role="alert">{error}</p> : null}

            <button className="gate-submit" disabled={loading} type="submit">
              {loading ? "Checking…" : "Continue"}
            </button>

            <p className="gate-footnote">
              Local demo —{" "}
              <code>agency@pulserank.local</code> / <code>password123</code>
            </p>

            <Link href="/" className="gate-back">
              ← Return home
            </Link>
          </form>
        </section>
      </div>
    </div>
  );
}

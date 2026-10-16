"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/invites", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: form.get("name"),
        password: form.get("password"),
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Invite failed");
      return;
    }
    router.push("/login");
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Accept invite</h1>
        <label className="field">
          Name
          <input name="name" required />
        </label>
        <label className="field">
          Password (12+ chars, upper, lower, number, symbol)
          <input name="password" type="password" required minLength={12} autoComplete="new-password" />
        </label>
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
        <button className="btn" type="submit">
          Create account
        </button>
      </form>
    </div>
  );
}

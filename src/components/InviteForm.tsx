"use client";

import { FormEvent, useState } from "react";

export function InviteForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [url, setUrl] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        organizationId: form.get("organizationId"),
        role: form.get("role"),
      }),
    });
    const data = await res.json();
    if (res.ok) setUrl(data.acceptUrl);
  }

  return (
    <form className="panel stack" onSubmit={onSubmit}>
      <h2>Invite client / teammate</h2>
      <label className="field">
        Organization
        <select name="organizationId" required>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Email
        <input name="email" type="email" required />
      </label>
      <label className="field">
        Role
        <select name="role" defaultValue="CLIENT_VIEWER">
          <option value="CLIENT_ADMIN">Client admin</option>
          <option value="CLIENT_VIEWER">Client viewer</option>
          <option value="AGENCY_MEMBER">Agency member</option>
        </select>
      </label>
      <button className="btn" type="submit">
        Create invite
      </button>
      {url ? <p className="muted">Invite URL: {url}</p> : null}
    </form>
  );
}

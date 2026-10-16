"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateOrgForm({ agencyId }: { agencyId?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        slug: form.get("slug"),
        type: form.get("type"),
        agencyId: agencyId || form.get("agencyId") || undefined,
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? `Created ${data.name}` : data.error || "Failed");
    if (res.ok) router.refresh();
  }

  return (
    <form className="panel stack" onSubmit={onSubmit}>
      <h2>Create organization</h2>
      <label className="field">
        Name
        <input name="name" required placeholder="Acme Corp" />
      </label>
      <label className="field">
        Slug
        <input name="slug" required placeholder="acme-corp" />
      </label>
      <label className="field">
        Type
        <select name="type" defaultValue="CLIENT">
          <option value="CLIENT">Client</option>
          <option value="AGENCY">Agency</option>
        </select>
      </label>
      {agencyId ? <input type="hidden" name="agencyId" value={agencyId} /> : null}
      <button className="btn" type="submit">
        Create
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </form>
  );
}

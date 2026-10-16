"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EmergencyStopControl({ active }: { active: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [current, setCurrent] = useState(active);

  async function toggle(next: boolean) {
    const res = await fetch("/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next, reason }),
    });
    if (res.ok) {
      setCurrent(next);
      router.refresh();
    }
  }

  return (
    <section className="panel stack">
      <h2>Global emergency stop</h2>
      <p className="muted">
        Halts job enqueue and worker execution across all websites. Does not delete data.
      </p>
      <div className="badge">{current ? "ACTIVE" : "inactive"}</div>
      <label className="field">
        Reason
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn danger" type="button" onClick={() => toggle(true)}>
          Activate stop
        </button>
        <button className="btn secondary" type="button" onClick={() => toggle(false)}>
          Release stop
        </button>
      </div>
    </section>
  );
}

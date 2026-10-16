"use client";

import { useState } from "react";

type Prospect = {
  id: string;
  domain: string;
  url: string;
  title: string;
  kind: string;
  status: string;
  score: number;
  nicheFit: string | null;
  outreachAngle: string | null;
  contactHint: string | null;
  source: string;
};

export function BacklinksPanel({
  websiteId,
  initial,
}: {
  websiteId: string;
  initial: Prospect[];
}) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [niche, setNiche] = useState("");
  const [list, setList] = useState<Prospect[]>(initial);

  async function runAgent() {
    setBusy(true);
    setLog("AI agent researching niche → searching guest posts / resources / directories…");
    try {
      const res = await fetch(`/api/websites/${websiteId}/backlinks`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setLog(data.error || "Failed");
        setBusy(false);
        return;
      }
      setList(data.prospects || []);
      setNiche(data.niche || "");
      const total = data.total ?? data.prospects?.length ?? 0;
      setLog(
        `${total} sites ready` +
          (data.catalogSize ? ` (catalog ${data.catalogSize})` : "") +
          ` · niche “${data.niche}” · +${data.created ?? 0} new. Easy-submit first.`
      );
      // Refresh fuller list from API
      const get = await fetch(`/api/websites/${websiteId}/backlinks`);
      if (get.ok) {
        const full = await get.json();
        if (full.prospects?.length) setList(full.prospects);
      }
    } catch (e) {
      setLog(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  }

  async function setStatus(prospectId: string, status: string) {
    const res = await fetch(`/api/websites/${websiteId}/backlinks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId, status }),
    });
    if (!res.ok) return;
    setList((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, status } : p))
    );
  }

  return (
    <section className="panel panel-rich" style={{ marginBottom: "1rem" }}>
      <p className="eyebrow">Backlinks module</p>
      <h2>AI backlink agent</h2>
      <p className="muted">
        Loads <strong>1000+ easy-submit</strong> directories, profiles &amp; free PR sites
        where you can add your link quickly — plus niche guest-post ideas.
        White-hat only — verify before submitting.
      </p>

      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" type="button" disabled={busy} onClick={runAgent}>
          {busy ? "Loading 1000+ sites…" : "Load 1000+ easy backlink sites"}
        </button>
      </div>

      {niche ? (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Niche focus: <strong>{niche}</strong>
        </p>
      ) : null}
      {log ? <p className="workflow-log">{log}</p> : null}

      {list.length ? (
        <div className="site-list" style={{ marginTop: "1rem", maxHeight: 640, overflow: "auto" }}>
          <p className="muted" style={{ marginBottom: "0.5rem" }}>
            Showing {Math.min(list.length, 100)} of {list.length}+ (sorted by score). Scroll for more after reload.
          </p>
          {list.map((p) => (
            <div key={p.id} className="backlink-row">
              <div className="backlink-main">
                <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  <strong>{p.title}</strong>
                  <span className="pill">{p.kind.replaceAll("_", " ")}</span>
                  <span className="pill">{Math.round(p.score)}</span>
                  <span className="pill">{p.status}</span>
                </div>
                <a href={p.url} target="_blank" rel="noreferrer" className="muted">
                  {p.domain} — {p.url.slice(0, 70)}
                  {p.url.length > 70 ? "…" : ""}
                </a>
                {p.nicheFit ? (
                  <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                    Fit: {p.nicheFit}
                  </p>
                ) : null}
                {p.outreachAngle ? (
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>
                    Pitch: {p.outreachAngle}
                  </p>
                ) : null}
                {p.contactHint ? (
                  <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
                    Contact: {p.contactHint}
                  </p>
                ) : null}
              </div>
              <div className="row" style={{ gap: "0.35rem" }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: "0.4rem 0.7rem", fontSize: "0.8rem" }}
                  onClick={() => setStatus(p.id, "SHORTLISTED")}
                >
                  Shortlist
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: "0.4rem 0.7rem", fontSize: "0.8rem" }}
                  onClick={() => setStatus(p.id, "OUTREACH")}
                >
                  Outreach
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: "0.4rem 0.7rem", fontSize: "0.8rem" }}
                  onClick={() => setStatus(p.id, "SKIPPED")}
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: "1rem" }}>
          No prospects yet. Click <strong>Find backlink sites</strong> to run the agent.
        </p>
      )}
    </section>
  );
}

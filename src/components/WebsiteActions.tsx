"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WebsiteActions({
  websiteId,
  settings,
  hasGsc,
}: {
  websiteId: string;
  settings: {
    autopilotEnabled: boolean;
    publishMode: string;
    dailyPublishLimit: number;
    weeklyPublishLimit: number;
    timezone: string;
    aiProvider: string;
    imageProvider: string;
    maxUsageBudgetUsd: number;
    minQualityThreshold: number;
    automaticTechnicalFixes: boolean;
  };
  hasGsc: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");

  async function enqueue(type: string, payload: Record<string, unknown> = {}) {
    setMsg(`Starting ${type}…`);
    const res = await fetch(`/api/websites/${websiteId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Queued ${type}` : data.error || "Failed");
    router.refresh();
  }

  async function saveSettings(form: FormData) {
    const res = await fetch(`/api/websites/${websiteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          autopilotEnabled: form.get("autopilotEnabled") === "on",
          publishMode: form.get("publishMode"),
          dailyPublishLimit: Number(form.get("dailyPublishLimit")),
          weeklyPublishLimit: Number(form.get("weeklyPublishLimit")),
          timezone: form.get("timezone"),
          aiProvider: form.get("aiProvider"),
          imageProvider: form.get("imageProvider"),
          maxUsageBudgetUsd: Number(form.get("maxUsageBudgetUsd")),
          minQualityThreshold: Number(form.get("minQualityThreshold")),
          automaticTechnicalFixes: form.get("automaticTechnicalFixes") === "on",
        },
      }),
    });
    setMsg(res.ok ? "Settings saved" : "Save failed");
    router.refresh();
  }

  async function connectGsc() {
    const res = await fetch(`/api/gsc/auth?websiteId=${websiteId}`);
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setMsg(data.error || "GSC not configured");
  }

  return (
    <div className="panel-grid" style={{ marginBottom: "1rem" }}>
      <section className="panel">
        <h2>Run jobs</h2>
        <div className="row">
          <button className="btn secondary" type="button" onClick={() => enqueue("SYNC_GSC")}>
            Sync GSC
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => enqueue("CRAWL_SEO_AUDIT")}
          >
            SEO audit
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => enqueue("DISCOVER_TOPICS")}
          >
            Discover topics
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => enqueue("GENERATE_ARTICLE")}
          >
            Generate article
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => enqueue("AUTOPILOT_PIPELINE")}
          >
            Full autopilot
          </button>
          <button className="btn secondary" type="button" onClick={connectGsc}>
            {hasGsc ? "Reconnect GSC" : "Connect GSC"}
          </button>
        </div>
        {msg ? <p className="muted">{msg}</p> : null}
      </section>

      <form
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault();
          void saveSettings(new FormData(e.currentTarget));
        }}
      >
        <h2>Website settings</h2>
        <label className="field">
          Publish mode
          <select name="publishMode" defaultValue={settings.publishMode}>
            <option value="DRAFT_ONLY">Draft only</option>
            <option value="APPROVAL_REQUIRED">Approval required</option>
            <option value="FULL_AUTOPILOT">Full autopilot</option>
          </select>
        </label>
        <label className="field">
          Autopilot enabled
          <input
            name="autopilotEnabled"
            type="checkbox"
            defaultChecked={settings.autopilotEnabled}
          />
        </label>
        <label className="field">
          Daily publish limit
          <input
            name="dailyPublishLimit"
            type="number"
            defaultValue={settings.dailyPublishLimit}
          />
        </label>
        <label className="field">
          Weekly publish limit
          <input
            name="weeklyPublishLimit"
            type="number"
            defaultValue={settings.weeklyPublishLimit}
          />
        </label>
        <label className="field">
          Timezone
          <input name="timezone" defaultValue={settings.timezone} />
        </label>
        <label className="field">
          AI provider
          <select name="aiProvider" defaultValue={settings.aiProvider}>
            <option value="grok">Grok (xAI)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="offline">Offline demo</option>
          </select>
        </label>
        <label className="field">
          Image provider
          <select name="imageProvider" defaultValue={settings.imageProvider}>
            <option value="openai">OpenAI</option>
            <option value="placeholder">Placeholder SVG</option>
          </select>
        </label>
        <label className="field">
          Max monthly budget (USD)
          <input
            name="maxUsageBudgetUsd"
            type="number"
            step="0.01"
            defaultValue={settings.maxUsageBudgetUsd}
          />
        </label>
        <label className="field">
          Min quality threshold (0–1)
          <input
            name="minQualityThreshold"
            type="number"
            step="0.05"
            defaultValue={settings.minQualityThreshold}
          />
        </label>
        <label className="field">
          Automatic technical fixes
          <input
            name="automaticTechnicalFixes"
            type="checkbox"
            defaultChecked={settings.automaticTechnicalFixes}
          />
        </label>
        <button className="btn" type="submit">
          Save settings
        </button>
      </form>
    </div>
  );
}

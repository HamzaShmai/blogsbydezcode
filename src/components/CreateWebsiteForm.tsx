"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const CMS_OPTIONS = [
  {
    id: "WORDPRESS",
    title: "WordPress",
    blurb: "Classic or headless WP via Application Password",
  },
  {
    id: "GIT_CONTENT",
    title: "Next.js / Astro",
    blurb: "Publish MDX into your GitHub content folder",
  },
  {
    id: "CUSTOM_WEBHOOK",
    title: "React / custom API",
    blurb: "Signed webhook into your own backend",
  },
  {
    id: "SHOPIFY",
    title: "Shopify",
    blurb: "Online Store blog articles",
  },
] as const;

export function CreateWebsiteForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [cmsType, setCmsType] = useState<string>("WORDPRESS");
  const [orgId, setOrgId] = useState(organizations[0]?.id || "");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [publishMode, setPublishMode] = useState("FULL_AUTOPILOT");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const cmsLabel = useMemo(
    () => CMS_OPTIONS.find((c) => c.id === cmsType)?.title ?? cmsType,
    [cmsType]
  );

  function goStep2() {
    if (!orgId || !name.trim() || !domain.trim()) {
      setMessage("Fill organization, name, and website link first.");
      return;
    }
    setMessage("");
    setStep(2);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const credentials: Record<string, string> = {};
    if (cmsType === "WORDPRESS") {
      credentials.baseUrl = String(form.get("baseUrl") || domain || "");
      credentials.username = String(form.get("username") || "");
      credentials.applicationPassword = String(form.get("applicationPassword") || "");
    } else if (cmsType === "SHOPIFY") {
      credentials.shopDomain = String(form.get("shopDomain") || "");
      credentials.accessToken = String(form.get("accessToken") || "");
      credentials.blogId = String(form.get("blogId") || "");
    } else if (cmsType === "CUSTOM_WEBHOOK") {
      credentials.webhookUrl = String(form.get("webhookUrl") || "");
      credentials.webhookSecret = String(form.get("webhookSecret") || "");
    } else if (cmsType === "GIT_CONTENT") {
      credentials.githubToken = String(form.get("githubToken") || "");
      credentials.githubRepo = String(form.get("githubRepo") || "");
      credentials.githubBranch = String(form.get("githubBranch") || "main");
      credentials.contentPath = String(form.get("contentPath") || "content/blog");
    }

    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const res = await fetch("/api/websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: orgId,
        name: name.trim(),
        domain: cleanDomain,
        cmsType,
        credentials,
        settings: {
          publishMode,
          autopilotEnabled: false,
        },
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error || "Could not connect");
      return;
    }
    setMessage("Connected — opening site…");
    router.push(`/agency/websites/${data.id}`);
    router.refresh();
  }

  return (
    <form className="panel panel-rich connect-wizard" onSubmit={onSubmit}>
      <div className="wizard-head">
        <div>
          <p className="eyebrow">Add site</p>
          <h2>Connect a website</h2>
          <p className="muted">
            Step {step} of 3 — credentials stay encrypted. Clients never see them.
          </p>
        </div>
        <div className="wizard-steps" aria-hidden>
          <span className={step >= 1 ? "on" : ""}>1</span>
          <span className={step >= 2 ? "on" : ""}>2</span>
          <span className={step >= 3 ? "on" : ""}>3</span>
        </div>
      </div>

      {step === 1 ? (
        <div className="wizard-body">
          <label className="gate-field">
            <span>Organization</span>
            <select
              required
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="gate-field">
            <span>Site name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Blog"
            />
          </label>
          <label className="gate-field">
            <span>Website link (domain)</span>
            <input
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="www.acme.com"
              inputMode="url"
            />
          </label>
          <p className="hint">
            We crawl this URL for pages, keywords, and SEO issues. Paste the live domain.
          </p>
          <button className="btn" type="button" onClick={goStep2}>
            Next — choose publish method
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="wizard-body">
          <p className="muted" style={{ marginBottom: "1rem" }}>
            How should PulseRank publish blog posts to this site?
          </p>
          <div className="cms-cards">
            {CMS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={cmsType === opt.id ? "cms-card is-on" : "cms-card"}
                onClick={() => setCmsType(opt.id)}
              >
                <strong>{opt.title}</strong>
                <span>{opt.blurb}</span>
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: "1.25rem" }}>
            <button className="btn secondary" type="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn" type="button" onClick={() => setStep(3)}>
              Next — {cmsLabel} details
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="wizard-body">
          <label className="gate-field">
            <span>When posts are ready</span>
            <select
              value={publishMode}
              onChange={(e) => setPublishMode(e.target.value)}
            >
              <option value="FULL_AUTOPILOT">
                Auto-post when CMS is connected (recommended)
              </option>
              <option value="APPROVAL_REQUIRED">Approve in PulseRank, then publish</option>
              <option value="DRAFT_ONLY">Draft only — never auto-post</option>
            </select>
          </label>

          {cmsType === "WORDPRESS" ? (
            <>
              <label className="gate-field">
                <span>WordPress site URL</span>
                <input name="baseUrl" placeholder="https://www.acme.com" defaultValue={domain.startsWith("http") ? domain : `https://${domain}`} />
              </label>
              <label className="gate-field">
                <span>WP username</span>
                <input name="username" autoComplete="off" placeholder="editor" />
              </label>
              <label className="gate-field">
                <span>Application password</span>
                <input
                  name="applicationPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="xxxx xxxx xxxx xxxx"
                />
              </label>
            </>
          ) : null}

          {cmsType === "SHOPIFY" ? (
            <>
              <label className="gate-field">
                <span>Shop domain</span>
                <input name="shopDomain" placeholder="store.myshopify.com" />
              </label>
              <label className="gate-field">
                <span>Admin API token</span>
                <input name="accessToken" type="password" autoComplete="new-password" />
              </label>
              <label className="gate-field">
                <span>Blog ID</span>
                <input name="blogId" placeholder="123456789" />
              </label>
            </>
          ) : null}

          {cmsType === "CUSTOM_WEBHOOK" ? (
            <>
              <label className="gate-field">
                <span>Webhook URL</span>
                <input name="webhookUrl" placeholder="https://api.yoursite.com/pulserank" />
              </label>
              <label className="gate-field">
                <span>Shared secret</span>
                <input name="webhookSecret" type="password" autoComplete="new-password" />
              </label>
            </>
          ) : null}

          {cmsType === "GIT_CONTENT" ? (
            <>
              <label className="gate-field">
                <span>GitHub repo</span>
                <input name="githubRepo" placeholder="org/repo" />
              </label>
              <label className="gate-field">
                <span>GitHub token</span>
                <input name="githubToken" type="password" autoComplete="new-password" />
              </label>
              <label className="gate-field">
                <span>Content folder</span>
                <input name="contentPath" defaultValue="content/blog" />
              </label>
              <label className="gate-field">
                <span>Branch</span>
                <input name="githubBranch" defaultValue="main" />
              </label>
            </>
          ) : null}

          <div className="row" style={{ marginTop: "1rem" }}>
            <button className="btn secondary" type="button" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Connecting…" : "Connect & open workspace"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="gate-error" style={{ marginTop: "1rem" }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

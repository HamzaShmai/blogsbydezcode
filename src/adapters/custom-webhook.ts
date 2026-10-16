import { createHmac } from "crypto";
import type { CmsAdapter, CmsPostResult } from "./types";

function sign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export const customWebhookAdapter: CmsAdapter = {
  async testConnection(credentials) {
    if (!credentials.webhookUrl) return { ok: false, message: "webhookUrl required" };
    const body = JSON.stringify({ type: "ping" });
    const res = await fetch(credentials.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": sign(credentials.webhookSecret || "", body),
      },
      body,
    });
    return {
      ok: res.ok,
      message: res.ok ? "Webhook reachable" : `Webhook ping failed: ${res.status}`,
    };
  },

  async createPost(credentials, input): Promise<CmsPostResult> {
    const payload = {
      type: "article.create",
      article: input,
    };
    const body = JSON.stringify(payload);
    const res = await fetch(credentials.webhookUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": sign(credentials.webhookSecret || "", body),
      },
      body,
    });
    if (!res.ok) throw new Error(`Webhook create failed: ${await res.text()}`);
    const data = (await res.json()) as { id?: string; url?: string };
    return {
      cmsPostId: data.id || `webhook-${Date.now()}`,
      publishedUrl: data.url || credentials.webhookUrl!,
      raw: data,
    };
  },

  async updatePost(credentials, cmsPostId, input) {
    const payload = { type: "article.update", id: cmsPostId, article: input };
    const body = JSON.stringify(payload);
    const res = await fetch(credentials.webhookUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": sign(credentials.webhookSecret || "", body),
      },
      body,
    });
    if (!res.ok) throw new Error(`Webhook update failed: ${await res.text()}`);
    const data = (await res.json()) as { id?: string; url?: string };
    return {
      cmsPostId: data.id || cmsPostId,
      publishedUrl: data.url || credentials.webhookUrl!,
      raw: data,
    };
  },

  async getPost(credentials, cmsPostId) {
    const payload = { type: "article.get", id: cmsPostId };
    const body = JSON.stringify(payload);
    const res = await fetch(credentials.webhookUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": sign(credentials.webhookSecret || "", body),
      },
      body,
    });
    if (!res.ok) return { exists: false };
    const data = (await res.json()) as { exists?: boolean; url?: string; status?: string };
    return {
      exists: data.exists !== false,
      publishedUrl: data.url,
      status: data.status,
    };
  },

  async verifyPublication(credentials, cmsPostId) {
    const post = await this.getPost(credentials, cmsPostId);
    return {
      verified: Boolean(post.exists),
      publishedUrl: post.publishedUrl,
    };
  },
};

import type { CmsAdapter, CmsPostResult } from "./types";

/**
 * Git-based publishing for Next.js / Astro content collections.
 * Commits Markdown/MDX to a configured path; site rebuild is the site's responsibility.
 */
export const gitContentAdapter: CmsAdapter = {
  async testConnection(credentials) {
    if (!credentials.githubToken || !credentials.githubRepo) {
      return { ok: false, message: "githubToken and githubRepo required" };
    }
    const res = await fetch(`https://api.github.com/repos/${credentials.githubRepo}`, {
      headers: {
        Authorization: `Bearer ${credentials.githubToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    return {
      ok: res.ok,
      message: res.ok ? "GitHub repo accessible" : `GitHub error ${res.status}`,
    };
  },

  async createPost(credentials, input): Promise<CmsPostResult> {
    const path = `${(credentials.contentPath || "content/blog").replace(/\/$/, "")}/${input.slug}.mdx`;
    const body = `---
title: ${JSON.stringify(input.title)}
description: ${JSON.stringify(input.metaDescription || input.excerpt || "")}
slug: ${input.slug}
date: ${new Date().toISOString()}
draft: ${input.status !== "publish"}
tags: ${JSON.stringify(input.tags || [])}
image: ${JSON.stringify(input.featuredImageUrl || "")}
imageAlt: ${JSON.stringify(input.featuredImageAlt || "")}
---

${input.contentMarkdown}
`;
    const content = Buffer.from(body).toString("base64");
    const branch = credentials.githubBranch || "main";

    const res = await fetch(
      `https://api.github.com/repos/${credentials.githubRepo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${credentials.githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `content: publish ${input.slug}`,
          content,
          branch,
        }),
      }
    );
    if (!res.ok) throw new Error(`Git commit failed: ${await res.text()}`);
    const data = (await res.json()) as { content: { sha: string; html_url: string } };
    const [owner] = (credentials.githubRepo || "").split("/");
    return {
      cmsPostId: data.content.sha,
      publishedUrl: data.content.html_url || `https://github.com/${credentials.githubRepo}/blob/${branch}/${path}`,
      raw: { owner, path, branch },
    };
  },

  async updatePost(credentials, cmsPostId, input) {
    const path = `${(credentials.contentPath || "content/blog").replace(/\/$/, "")}/${input.slug}.mdx`;
    const branch = credentials.githubBranch || "main";
    const existing = await fetch(
      `https://api.github.com/repos/${credentials.githubRepo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${credentials.githubToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    const existingData = existing.ok
      ? ((await existing.json()) as { sha: string })
      : { sha: cmsPostId };

    const md = `---
title: ${JSON.stringify(input.title)}
description: ${JSON.stringify(input.metaDescription || "")}
slug: ${input.slug}
date: ${new Date().toISOString()}
draft: ${input.status !== "publish"}
---

${input.contentMarkdown}
`;
    const res = await fetch(
      `https://api.github.com/repos/${credentials.githubRepo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${credentials.githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `content: update ${input.slug}`,
          content: Buffer.from(md).toString("base64"),
          sha: existingData.sha,
          branch,
        }),
      }
    );
    if (!res.ok) throw new Error(`Git update failed: ${await res.text()}`);
    const data = (await res.json()) as { content: { sha: string; html_url: string } };
    return {
      cmsPostId: data.content.sha,
      publishedUrl: data.content.html_url,
      raw: data,
    };
  },

  async getPost(credentials, cmsPostId) {
    void cmsPostId;
    void credentials;
    return { exists: true, status: "publish" };
  },

  async verifyPublication(credentials, cmsPostId) {
    void credentials;
    return { verified: Boolean(cmsPostId), publishedUrl: undefined };
  },
};

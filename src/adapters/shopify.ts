import type { CmsAdapter, CmsCredentials, CmsPostResult } from "./types";

function shopBase(credentials: CmsCredentials) {
  const domain = (credentials.shopDomain || "").replace(/^https?:\/\//, "");
  return `https://${domain}/admin/api/2024-01`;
}

function headers(credentials: CmsCredentials) {
  return {
    "X-Shopify-Access-Token": credentials.accessToken || "",
    "Content-Type": "application/json",
  };
}

export const shopifyAdapter: CmsAdapter = {
  async testConnection(credentials) {
    const res = await fetch(`${shopBase(credentials)}/blogs.json`, {
      headers: headers(credentials),
    });
    if (!res.ok) return { ok: false, message: `Shopify auth failed: ${res.status}` };
    return { ok: true, message: "Shopify connection OK" };
  },

  async createPost(credentials, input): Promise<CmsPostResult> {
    const blogId = credentials.blogId;
    if (!blogId) throw new Error("Shopify blogId required");
    const res = await fetch(`${shopBase(credentials)}/blogs/${blogId}/articles.json`, {
      method: "POST",
      headers: headers(credentials),
      body: JSON.stringify({
        article: {
          title: input.title,
          author: "SEO Autopilot",
          body_html: input.contentHtml,
          summary: input.excerpt,
          tags: (input.tags || []).join(", "),
          published: input.status === "publish",
          handle: input.slug,
          image: input.featuredImageUrl
            ? { src: input.featuredImageUrl, alt: input.featuredImageAlt }
            : undefined,
          metafields: [
            {
              namespace: "global",
              key: "title_tag",
              value: input.seoTitle || input.title,
              type: "single_line_text_field",
            },
            {
              namespace: "global",
              key: "description_tag",
              value: input.metaDescription || "",
              type: "single_line_text_field",
            },
          ],
        },
      }),
    });
    if (!res.ok) throw new Error(`Shopify createPost failed: ${await res.text()}`);
    const data = (await res.json()) as {
      article: { id: number; handle: string };
    };
    const domain = (credentials.shopDomain || "").replace(/^https?:\/\//, "");
    return {
      cmsPostId: String(data.article.id),
      publishedUrl: `https://${domain}/blogs/news/${data.article.handle}`,
      raw: data,
    };
  },

  async updatePost(credentials, cmsPostId, input) {
    const blogId = credentials.blogId;
    if (!blogId) throw new Error("Shopify blogId required");
    const res = await fetch(
      `${shopBase(credentials)}/blogs/${blogId}/articles/${cmsPostId}.json`,
      {
        method: "PUT",
        headers: headers(credentials),
        body: JSON.stringify({
          article: {
            id: Number(cmsPostId),
            title: input.title,
            body_html: input.contentHtml,
            published: input.status === "publish",
          },
        }),
      }
    );
    if (!res.ok) throw new Error(`Shopify updatePost failed: ${await res.text()}`);
    const data = (await res.json()) as { article: { id: number; handle: string } };
    const domain = (credentials.shopDomain || "").replace(/^https?:\/\//, "");
    return {
      cmsPostId: String(data.article.id),
      publishedUrl: `https://${domain}/blogs/news/${data.article.handle}`,
      raw: data,
    };
  },

  async getPost(credentials, cmsPostId) {
    const blogId = credentials.blogId;
    if (!blogId) throw new Error("Shopify blogId required");
    const res = await fetch(
      `${shopBase(credentials)}/blogs/${blogId}/articles/${cmsPostId}.json`,
      { headers: headers(credentials) }
    );
    if (res.status === 404) return { exists: false };
    if (!res.ok) throw new Error(`Shopify getPost failed: ${res.status}`);
    const data = (await res.json()) as { article: { handle: string; published_at: string | null } };
    const domain = (credentials.shopDomain || "").replace(/^https?:\/\//, "");
    return {
      exists: true,
      publishedUrl: `https://${domain}/blogs/news/${data.article.handle}`,
      status: data.article.published_at ? "publish" : "draft",
    };
  },

  async verifyPublication(credentials, cmsPostId) {
    const post = await this.getPost(credentials, cmsPostId);
    return {
      verified: Boolean(post.exists && post.status === "publish"),
      publishedUrl: post.publishedUrl,
      error: post.exists ? undefined : "Not found",
    };
  },
};

import type { CmsAdapter, CmsCredentials, CmsPostInput, CmsPostResult } from "./types";

function authHeader(credentials: CmsCredentials) {
  const token = Buffer.from(
    `${credentials.username}:${credentials.applicationPassword}`
  ).toString("base64");
  return `Basic ${token}`;
}

function apiBase(credentials: CmsCredentials) {
  const base = (credentials.baseUrl || "").replace(/\/$/, "");
  return `${base}/wp-json/wp/v2`;
}

async function fetchImageBytes(
  imageUrl: string
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  try {
    if (imageUrl.startsWith("data:")) {
      const m = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return null;
      const contentType = m[1] || "image/png";
      const buffer = Buffer.from(m[2]!, "base64");
      const ext = contentType.includes("svg")
        ? "svg"
        : contentType.includes("png")
          ? "png"
          : contentType.includes("webp")
            ? "webp"
            : "jpg";
      // Many WP hosts block SVG uploads — skip SVG placeholders
      if (ext === "svg") return null;
      return { buffer, contentType, filename: `featured.${ext}` };
    }
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "PulseRankBot/1.0 (+media-upload)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (contentType.includes("svg")) return null;
    const ab = await res.arrayBuffer();
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    return {
      buffer: Buffer.from(ab),
      contentType,
      filename: `featured-${Date.now()}.${ext}`,
    };
  } catch {
    return null;
  }
}

/** Upload featured image to WP Media library with alt text. */
export async function uploadWordpressMedia(
  credentials: CmsCredentials,
  imageUrl: string,
  altText: string
): Promise<number | null> {
  const file = await fetchImageBytes(imageUrl);
  if (!file) return null;

  const res = await fetch(`${apiBase(credentials)}/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader(credentials),
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Content-Type": file.contentType,
    },
    body: new Uint8Array(file.buffer),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id: number };

  // Set alt text
  await fetch(`${apiBase(credentials)}/media/${data.id}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(credentials),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      alt_text: altText.slice(0, 200),
      title: altText.slice(0, 120),
      caption: altText.slice(0, 200),
    }),
  }).catch(() => undefined);

  return data.id;
}

async function ensureTags(
  credentials: CmsCredentials,
  tags: string[]
): Promise<number[]> {
  const ids: number[] = [];
  for (const name of tags.slice(0, 8)) {
    const clean = name.trim().slice(0, 60);
    if (!clean) continue;
    try {
      const search = await fetch(
        `${apiBase(credentials)}/tags?search=${encodeURIComponent(clean)}&per_page=5`,
        { headers: { Authorization: authHeader(credentials) } }
      );
      if (search.ok) {
        const found = (await search.json()) as { id: number; name: string }[];
        const hit = found.find(
          (t) => t.name.toLowerCase() === clean.toLowerCase()
        );
        if (hit) {
          ids.push(hit.id);
          continue;
        }
      }
      const create = await fetch(`${apiBase(credentials)}/tags`, {
        method: "POST",
        headers: {
          Authorization: authHeader(credentials),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: clean }),
      });
      if (create.ok) {
        const tag = (await create.json()) as { id: number };
        ids.push(tag.id);
      }
    } catch {
      /* ignore tag errors */
    }
  }
  return ids;
}

function postBody(
  input: CmsPostInput,
  extras: { featuredMedia?: number | null; tagIds?: number[] }
) {
  return {
    title: input.title,
    slug: input.slug,
    content: input.contentHtml,
    excerpt: input.excerpt ?? input.metaDescription ?? "",
    status: input.status === "publish" ? "publish" : "draft",
    ...(extras.featuredMedia ? { featured_media: extras.featuredMedia } : {}),
    ...(extras.tagIds?.length ? { tags: extras.tagIds } : {}),
    meta: {
      _yoast_wpseo_title: input.seoTitle || input.title,
      _yoast_wpseo_metadesc: input.metaDescription || input.excerpt || "",
      _yoast_wpseo_focuskw: input.tags?.[0] || "",
    },
  };
}

export const wordpressAdapter: CmsAdapter = {
  async testConnection(credentials) {
    const res = await fetch(`${apiBase(credentials)}/users/me?context=edit`, {
      headers: { Authorization: authHeader(credentials) },
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `WordPress login failed (${res.status}). Use Application Password from Users → Profile.`,
      };
    }
    const me = (await res.json()) as { name?: string; capabilities?: Record<string, boolean> };
    const canPublish = Boolean(me.capabilities?.publish_posts || me.capabilities?.edit_posts);
    return {
      ok: true,
      message: canPublish
        ? `WordPress OK — logged in as ${me.name || "user"} (can create posts)`
        : `WordPress OK as ${me.name || "user"} — may lack publish permission`,
    };
  },

  async createPost(credentials, input): Promise<CmsPostResult> {
    let featuredMedia: number | null = null;
    if (input.featuredImageUrl) {
      featuredMedia = await uploadWordpressMedia(
        credentials,
        input.featuredImageUrl,
        input.featuredImageAlt || input.title
      );
    }
    const tagIds = input.tags?.length
      ? await ensureTags(credentials, input.tags)
      : [];

    const res = await fetch(`${apiBase(credentials)}/posts`, {
      method: "POST",
      headers: {
        Authorization: authHeader(credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody(input, { featuredMedia, tagIds })),
    });
    if (!res.ok) throw new Error(`WordPress createPost failed: ${await res.text()}`);
    const data = (await res.json()) as { id: number; link: string };
    return {
      cmsPostId: String(data.id),
      publishedUrl: data.link,
      raw: { ...data, featuredMedia, tagIds },
    };
  },

  async updatePost(credentials, cmsPostId, input) {
    let featuredMedia: number | null = null;
    if (input.featuredImageUrl) {
      featuredMedia = await uploadWordpressMedia(
        credentials,
        input.featuredImageUrl,
        input.featuredImageAlt || input.title
      );
    }
    const tagIds = input.tags?.length
      ? await ensureTags(credentials, input.tags)
      : [];

    const res = await fetch(`${apiBase(credentials)}/posts/${cmsPostId}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody(input, { featuredMedia, tagIds })),
    });
    if (!res.ok) throw new Error(`WordPress updatePost failed: ${await res.text()}`);
    const data = (await res.json()) as { id: number; link: string };
    return { cmsPostId: String(data.id), publishedUrl: data.link, raw: data };
  },

  async getPost(credentials, cmsPostId) {
    const res = await fetch(`${apiBase(credentials)}/posts/${cmsPostId}`, {
      headers: { Authorization: authHeader(credentials) },
    });
    if (res.status === 404) return { exists: false };
    if (!res.ok) throw new Error(`WordPress getPost failed: ${res.status}`);
    const data = (await res.json()) as { link: string; status: string };
    return { exists: true, publishedUrl: data.link, status: data.status };
  },

  async verifyPublication(credentials, cmsPostId) {
    try {
      const post = await this.getPost(credentials, cmsPostId);
      if (!post.exists) return { verified: false, error: "Post not found" };
      if (post.publishedUrl) {
        const live = await fetch(post.publishedUrl, { method: "HEAD" });
        return {
          verified: live.ok || live.status === 405,
          publishedUrl: post.publishedUrl,
        };
      }
      return { verified: false, error: "No URL" };
    } catch (e) {
      return { verified: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

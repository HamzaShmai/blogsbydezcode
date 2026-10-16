export type CmsCredentials = {
  // WordPress
  baseUrl?: string;
  username?: string;
  applicationPassword?: string;
  // Shopify
  shopDomain?: string;
  accessToken?: string;
  blogId?: string;
  // Custom webhook
  webhookUrl?: string;
  webhookSecret?: string;
  // Git content
  githubToken?: string;
  githubRepo?: string;
  githubBranch?: string;
  contentPath?: string;
};

export type CmsPostInput = {
  title: string;
  slug: string;
  contentHtml: string;
  contentMarkdown: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[];
  featuredImageUrl?: string | null;
  featuredImageAlt?: string | null;
  status: "draft" | "publish";
  categoryName?: string | null;
};

export type CmsPostResult = {
  cmsPostId: string;
  publishedUrl: string;
  raw?: unknown;
};

export interface CmsAdapter {
  testConnection(credentials: CmsCredentials): Promise<{ ok: boolean; message: string }>;
  createPost(credentials: CmsCredentials, input: CmsPostInput): Promise<CmsPostResult>;
  updatePost(
    credentials: CmsCredentials,
    cmsPostId: string,
    input: CmsPostInput
  ): Promise<CmsPostResult>;
  getPost(
    credentials: CmsCredentials,
    cmsPostId: string
  ): Promise<{ exists: boolean; publishedUrl?: string; status?: string }>;
  verifyPublication(
    credentials: CmsCredentials,
    cmsPostId: string
  ): Promise<{ verified: boolean; publishedUrl?: string; error?: string }>;
}

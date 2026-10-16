import { CmsType } from "@prisma/client";
import type { CmsAdapter } from "./types";
import { wordpressAdapter } from "./wordpress";
import { shopifyAdapter } from "./shopify";
import { customWebhookAdapter } from "./custom-webhook";
import { gitContentAdapter } from "./git-content";

export function getAdapter(cmsType: CmsType): CmsAdapter {
  switch (cmsType) {
    case CmsType.WORDPRESS:
      return wordpressAdapter;
    case CmsType.SHOPIFY:
      return shopifyAdapter;
    case CmsType.CUSTOM_WEBHOOK:
      return customWebhookAdapter;
    case CmsType.GIT_CONTENT:
      return gitContentAdapter;
    default:
      throw new Error(`Unsupported CMS type: ${cmsType}`);
  }
}

export * from "./types";

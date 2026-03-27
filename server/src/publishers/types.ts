export interface PublishPayload {
  title: string;
  content_markdown: string;
  content_html?: string | null;
  tags: string[];
  canonical_url: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  slug: string | null;
}

export interface PublishResult {
  platform: string;
  success: boolean;
  url?: string;
  error?: string;
}

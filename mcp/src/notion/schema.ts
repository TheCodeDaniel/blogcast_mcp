/**
 * Notion database property name mappings.
 * Update these if you rename properties in your Notion database.
 */
export const POSTS_DB_PROPERTIES = {
  title: "Title",
  slug: "Slug",
  status: "Status",
  publishTo: "Publish To",
  scheduledAt: "Scheduled At",
  tags: "Tags",
  canonicalUrl: "Canonical URL",
  coverImage: "Cover Image",
  excerpt: "Excerpt",
  publishedAt: "Published At",
  wordCount: "Word Count",
  lastSynced: "Last Synced",
} as const;

export const ANALYTICS_DB_PROPERTIES = {
  post: "Post",
  platform: "Platform",
  status: "Status",
  publishedUrl: "Published URL",
  errorMessage: "Error Message",
  publishedAt: "Published At",
  reactions: "Reactions",
  pageViews: "Page Views",
  comments: "Comments",
} as const;

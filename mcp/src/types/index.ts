export type PostStatus =
  | "Draft"
  | "Review"
  | "Scheduled"
  | "Published"
  | "Failed"
  | "Archived";

export type Platform =
  | "devto"
  | "hashnode"
  | "medium"
  | "linkedin"
  | "ghost"
  | "wordpress";

export type AnalyticsStatus = "Success" | "Failed" | "Pending";

export interface NotionPost {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  publishTo: Platform[];
  scheduledAt: string | null;
  tags: string[];
  canonicalUrl: string | null;
  coverImage: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  wordCount: number | null;
  lastSynced: string | null;
  lastEditedTime: string;
  createdTime: string;
}

export interface NotionPostContent extends NotionPost {
  markdownContent: string;
}

export interface AnalyticsEntry {
  id: string;
  postId: string;
  platform: Platform;
  status: AnalyticsStatus;
  publishedUrl: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  reactions: number | null;
  pageViews: number | null;
  comments: number | null;
}

export interface PublishResult {
  platform: Platform;
  success: boolean;
  url?: string;
  error?: string;
}

export interface PublishResponse {
  results: PublishResult[];
  notionPostId: string;
}

export interface PlatformCredential {
  platform: Platform;
  configured: boolean;
  fields: Record<string, string>;
}

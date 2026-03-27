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

export interface Post {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  publishTo: Platform[];
  scheduledAt: string | null;
  tags: string[];
  excerpt: string | null;
  publishedAt: string | null;
  wordCount: number | null;
  lastSynced: string | null;
  lastEditedTime: string;
  createdTime: string;
}

export interface AnalyticsEntry {
  id: string;
  platform: Platform;
  status: AnalyticsStatus;
  publishedUrl: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  reactions: number | null;
  pageViews: number | null;
  comments: number | null;
}

export interface PlatformInfo {
  platform: Platform;
  configured: boolean;
  connected: boolean;
  v1Supported: boolean;
}

export interface PublishResult {
  platform: string;
  success: boolean;
  url?: string;
  error?: string;
}

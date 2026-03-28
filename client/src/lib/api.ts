import axios from "axios";
import type { Post, AnalyticsEntry, PlatformInfo, PublishResult } from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  timeout: 60_000,
});

// ── Config ────────────────────────────────────────────────────────────────────

export interface AppConfigResponse {
  notion: {
    apiKey: string;        // masked if set
    postsDbId: string;
    analyticsDbId: string;
    fromEnv: { apiKey: boolean; postsDbId: boolean; analyticsDbId: boolean };
  };
  scheduler: { enabled: boolean; pollIntervalMinutes: number };
  server: { storagePathOverride: string };
  anthropic: { apiKey: string; fromEnv: boolean };
  configured: boolean;
  anthropicConfigured: boolean;
}

export async function getConfig(): Promise<AppConfigResponse> {
  const res = await api.get("/api/config");
  return res.data;
}

export async function saveConfig(config: {
  notion?: { apiKey?: string; postsDbId?: string; analyticsDbId?: string };
  scheduler?: { enabled?: boolean; pollIntervalMinutes?: number };
  server?: { storagePathOverride?: string };
  anthropic?: { apiKey?: string };
}): Promise<void> {
  await api.post("/api/config", config);
}

export async function clearNotionConfig(): Promise<void> {
  await api.delete("/api/config/notion");
}

export async function clearAnthropicConfig(): Promise<void> {
  await api.delete("/api/config/anthropic");
}

export async function configureClaudeDesktop(): Promise<{
  success: boolean;
  path: string;
  alreadyExisted: boolean;
  message: string;
}> {
  const res = await api.post("/api/config/claude-desktop");
  return res.data;
}

// ── AI ────────────────────────────────────────────────────────────────────────

export async function precheckPost(data: {
  title: string;
  content: string;
  tags: string[];
  excerpt: string;
}): Promise<{ warnings: string[] }> {
  const res = await api.post("/api/ai/precheck", data);
  return res.data;
}

export async function enhancePost(data: {
  title: string;
  content: string;
}): Promise<{ excerpt: string; tags: string[] }> {
  const res = await api.post("/api/ai/enhance", data);
  return res.data;
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function getPosts(params?: {
  status?: string;
  limit?: number;
}): Promise<{ posts: Post[]; total: number }> {
  const res = await api.get("/api/posts", { params });
  return res.data;
}

export async function getPost(id: string): Promise<Post> {
  const res = await api.get(`/api/posts/${id}`);
  return res.data;
}

export async function getPostStatus(
  id: string
): Promise<{ postId: string; analytics: AnalyticsEntry[] }> {
  const res = await api.get(`/api/posts/${id}/status`);
  return res.data;
}

// ── Publish ───────────────────────────────────────────────────────────────────

export async function publishPost(
  postId: string,
  platforms: string[],
  contentMarkdown?: string  // pass pre-loaded content to skip re-fetching from Notion
): Promise<{ results: PublishResult[] }> {
  const [post, contentRes] = await Promise.all([
    getPost(postId),
    contentMarkdown !== undefined
      ? Promise.resolve({ markdown: contentMarkdown })
      : getPostContent(postId),
  ]);

  const res = await api.post("/api/publish", {
    post: {
      title: post.title,
      content_markdown: contentRes.markdown,
      tags: post.tags,
      canonical_url: null,
      cover_image_url: null,
      excerpt: post.excerpt,
      slug: post.slug,
    },
    platforms,
    notion_page_id: postId,
  });
  return res.data;
}

export async function getPostContent(id: string): Promise<{ markdown: string }> {
  const res = await api.get(`/api/posts/${id}/content`);
  return res.data;
}

export async function createPost(data: {
  title: string;
  content_markdown: string;
  tags: string[];
  excerpt: string;
  slug?: string;
  status: "Draft" | "Review";
  publishTo: string[];
  canonicalUrl?: string;
}): Promise<{ id: string; post: Post }> {
  const res = await api.post("/api/posts", data);
  return res.data;
}

export async function setupNotion(): Promise<{
  success: boolean;
  postsDbId: string;
  analyticsDbId: string;
}> {
  const res = await api.post("/api/setup/notion");
  return res.data;
}

// ── Platforms ─────────────────────────────────────────────────────────────────

export async function getPlatforms(): Promise<PlatformInfo[]> {
  const res = await api.get("/api/platforms");
  return res.data;
}

export async function savePlatformCredentials(
  platform: string,
  credentials: Record<string, string>
): Promise<void> {
  await api.post(`/api/platforms/${platform}/credentials`, { credentials });
}

export async function removePlatformCredentials(platform: string): Promise<void> {
  await api.delete(`/api/platforms/${platform}/credentials`);
}

export async function testPlatformConnection(
  platform: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.post(`/api/platforms/${platform}/test`);
  return res.data;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function syncAnalytics(postIds: string[]): Promise<{
  synced: number;
  errors: Array<{ postId: string; platform: string; error: string }>;
}> {
  const res = await api.post("/api/analytics/sync", { post_ids: postIds });
  return res.data;
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<{
  status: string;
  version: string;
  services: { notion: boolean; scheduler: boolean };
}> {
  const res = await api.get("/health");
  return res.data;
}

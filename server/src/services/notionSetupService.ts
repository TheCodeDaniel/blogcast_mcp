import { configService } from "./configService.js";
import { logger } from "../utils/logger.js";

const NOTION_VERSION = "2022-06-28";

/**
 * Idempotent migration that PATCHes both Notion databases to ensure all
 * required BlogCast properties exist. Safe to call on every startup.
 */
export async function setupNotionDatabases(): Promise<{
  posts: string;
  analytics: string;
}> {
  const apiKey = configService.getNotionApiKey();
  const postsDbId = configService.getNotionPostsDbId();
  const analyticsDbId = configService.getNotionAnalyticsDbId();

  if (!apiKey || !postsDbId || !analyticsDbId) {
    throw new Error("Notion not fully configured — skipping DB setup.");
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };

  // ── GET Posts DB — verify access + find the title property's current name ──
  const checkRes = await fetch(`https://api.notion.com/v1/databases/${postsDbId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": NOTION_VERSION },
  });

  if (!checkRes.ok) {
    const text = await checkRes.text();
    throw new Error(
      `Cannot access Posts DB (${checkRes.status}): ${text}\n` +
      `Make sure your integration is connected to the database in Notion ` +
      `(open DB → ⋯ → Connections → add your integration).`
    );
  }

  const postsDb = await checkRes.json() as { properties: Record<string, { type: string }> };

  // Find whatever the title column is currently called (Notion default: "Name")
  const currentTitleName = Object.entries(postsDb.properties)
    .find(([, prop]) => prop.type === "title")?.[0];

  // If the title column isn't already named "Title", rename it
  const titleRename =
    currentTitleName && currentTitleName !== "Title"
      ? { [currentTitleName]: { name: "Title", title: {} } }
      : {};

  // ── PATCH Posts DB — rename title column + ensure all required columns ─────
  const postsRes = await fetch(`https://api.notion.com/v1/databases/${postsDbId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      properties: {
        ...titleRename,
        Slug: { rich_text: {} },
        Status: {
          select: {
            options: [
              { name: "Draft", color: "gray" },
              { name: "Review", color: "yellow" },
              { name: "Scheduled", color: "blue" },
              { name: "Published", color: "green" },
              { name: "Failed", color: "red" },
              { name: "Archived", color: "default" },
            ],
          },
        },
        "Publish To": {
          multi_select: {
            options: [
              { name: "devto", color: "blue" },
              { name: "hashnode", color: "purple" },
              { name: "medium", color: "green" },
            ],
          },
        },
        "Scheduled At": { date: {} },
        Tags: { multi_select: {} },
        "Canonical URL": { url: {} },
        Excerpt: { rich_text: {} },
        "Published At": { date: {} },
        "Word Count": { number: {} },
        "Last Synced": { date: {} },
      },
    }),
  });

  if (!postsRes.ok) {
    const text = await postsRes.text();
    throw new Error(`Posts DB migration failed (${postsRes.status}): ${text}`);
  }

  // ── PATCH Analytics DB — ensure all required columns exist ─────────────────
  const analyticsRes = await fetch(`https://api.notion.com/v1/databases/${analyticsDbId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      properties: {
        Post: {
          relation: {
            database_id: postsDbId,
            type: "single_property",
            single_property: {},
          },
        },
        Platform: {
          select: {
            options: [
              { name: "devto", color: "blue" },
              { name: "hashnode", color: "purple" },
              { name: "medium", color: "green" },
            ],
          },
        },
        Status: {
          select: {
            options: [
              { name: "Success", color: "green" },
              { name: "Failed", color: "red" },
              { name: "Pending", color: "yellow" },
            ],
          },
        },
        "Published URL": { url: {} },
        "Error Message": { rich_text: {} },
        "Published At": { date: {} },
        Reactions: { number: {} },
        "Page Views": { number: {} },
        Comments: { number: {} },
      },
    }),
  });

  if (!analyticsRes.ok) {
    const text = await analyticsRes.text();
    throw new Error(`Analytics DB migration failed (${analyticsRes.status}): ${text}`);
  }

  logger.info("Notion DB setup complete", { postsDbId, analyticsDbId });
  return { posts: postsDbId, analytics: analyticsDbId };
}

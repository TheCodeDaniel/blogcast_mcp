import { Router } from "express";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import { syncDevtoAnalytics } from "../publishers/devto.js";
import { syncHashnodeAnalytics } from "../publishers/hashnode.js";
import { logger } from "../utils/logger.js";

export const analyticsRouter = Router();

type StatsSyncer = (url: string) => Promise<{
  reactions: number;
  pageViews: number;
  comments: number;
} | null>;

const SYNCERS: Record<string, StatsSyncer> = {
  devto: syncDevtoAnalytics,
  hashnode: syncHashnodeAnalytics,
};

// POST /api/analytics/sync — pull latest stats from platforms
analyticsRouter.post("/sync", async (req, res) => {
  const { post_ids } = req.body;

  if (!Array.isArray(post_ids) || post_ids.length === 0) {
    res.status(400).json({ error: "post_ids must be a non-empty array" });
    return;
  }

  const notion = new Client({ auth: process.env.NOTION_API_KEY! });
  let synced = 0;
  const errors: Array<{ postId: string; platform: string; error: string }> = [];

  for (const postId of post_ids) {
    try {
      // Get analytics entries for this post
      const response = await notion.databases.query({
        database_id: process.env.NOTION_ANALYTICS_DB_ID!,
        filter: {
          property: "Post",
          relation: { contains: postId },
        },
      });

      const entries = response.results.filter(
        (p): p is PageObjectResponse => "properties" in p
      );

      for (const entry of entries) {
        const props = entry.properties as Record<string, any>;
        const platform =
          props["Platform"]?.select?.name?.toLowerCase() ?? "";
        const publishedUrl = props["Published URL"]?.url ?? null;
        const status = props["Status"]?.select?.name ?? "";

        if (status !== "Success" || !publishedUrl || !SYNCERS[platform]) {
          continue;
        }

        try {
          const stats = await SYNCERS[platform](publishedUrl);
          if (!stats) continue;

          const updates: Record<string, any> = {};
          if (stats.reactions !== undefined)
            updates["Reactions"] = { number: stats.reactions };
          if (stats.pageViews !== undefined)
            updates["Page Views"] = { number: stats.pageViews };
          if (stats.comments !== undefined)
            updates["Comments"] = { number: stats.comments };

          await notion.pages.update({ page_id: entry.id, properties: updates });
          synced++;
        } catch (err: any) {
          errors.push({ postId, platform, error: err.message });
          logger.error(`Failed to sync ${platform} stats for post ${postId}`, {
            error: err.message,
          });
        }
      }
    } catch (err: any) {
      logger.error(`Failed to query analytics for post ${postId}`, {
        error: err.message,
      });
    }
  }

  res.json({ synced, errors });
});

import { Router } from "express";
import { publishToDevto } from "../publishers/devto.js";
import { publishToHashnode } from "../publishers/hashnode.js";
import { publishToMedium } from "../publishers/medium.js";
import { adaptContentForPlatform } from "../services/aiService.js";
import { configService } from "../services/configService.js";
import { logger } from "../utils/logger.js";
import type { PublishPayload, PublishResult } from "../publishers/types.js";

export const publishRouter = Router();

type Publisher = (payload: PublishPayload) => Promise<PublishResult>;

const PUBLISHERS: Record<string, Publisher> = {
  devto: publishToDevto,
  hashnode: publishToHashnode,
  medium: publishToMedium,
};

// POST /api/publish
publishRouter.post("/", async (req, res) => {
  const { post, platforms, notion_page_id } = req.body;

  if (!post || !platforms || !Array.isArray(platforms)) {
    res.status(400).json({
      error: "Request body must include post object and platforms array",
    });
    return;
  }

  if (!post.title || !post.content_markdown) {
    res.status(400).json({ error: "post.title and post.content_markdown are required" });
    return;
  }

  const payload: PublishPayload = {
    title: post.title,
    content_markdown: post.content_markdown,
    tags: post.tags ?? [],
    canonical_url: post.canonical_url ?? null,
    cover_image_url: post.cover_image_url ?? null,
    excerpt: post.excerpt ?? null,
    slug: post.slug ?? null,
  };

  logger.info(`Publishing post: "${post.title}"`, {
    platforms,
    notionPageId: notion_page_id,
  });

  const aiEnabled = configService.isAnthropicConfigured();

  // Publish to all requested platforms in parallel
  const results = await Promise.all(
    platforms.map(async (platform: string) => {
      const publisher = PUBLISHERS[platform];

      if (!publisher) {
        return {
          platform,
          success: false,
          error: `Platform "${platform}" is not supported in v1.0. Supported: ${Object.keys(PUBLISHERS).join(", ")}`,
        } as PublishResult;
      }

      // Build per-platform payload with optional AI content adaptation
      let platformPayload = { ...payload };

      if (aiEnabled && ["devto", "hashnode", "medium"].includes(platform)) {
        try {
          const adapted = await adaptContentForPlatform(
            payload.content_markdown,
            platform as "devto" | "hashnode" | "medium",
            { title: payload.title, tags: payload.tags }
          );
          if (platform === "medium") {
            // For Medium, the adapted content is already HTML
            platformPayload = { ...payload, content_html: adapted };
          } else {
            platformPayload = { ...payload, content_markdown: adapted };
          }
        } catch (err: any) {
          logger.warn(`AI adaptation skipped for ${platform}`, { error: err.message });
        }
      }

      try {
        return await publisher(platformPayload);
      } catch (err: any) {
        logger.error(`Publisher threw for ${platform}`, { error: err.message });
        return {
          platform,
          success: false,
          error: err.message ?? "Unexpected publisher error",
        } as PublishResult;
      }
    })
  );

  res.json({ results, notion_page_id });
});

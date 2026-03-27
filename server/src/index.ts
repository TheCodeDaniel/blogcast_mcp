import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";

import { postsRouter } from "./routes/posts.js";
import { publishRouter } from "./routes/publish.js";
import { platformsRouter } from "./routes/platforms.js";
import { imagesRouter } from "./routes/images.js";
import { analyticsRouter } from "./routes/analytics.js";
import { configRouter } from "./routes/config.js";
import { aiRouter } from "./routes/ai.js";
import { startScheduler } from "./services/schedulerService.js";
import { configService } from "./services/configService.js";
import { publishToDevto } from "./publishers/devto.js";
import { publishToHashnode } from "./publishers/hashnode.js";
import { logger } from "./utils/logger.js";
import type { PublishPayload } from "./publishers/types.js";

// ── Storage directories ───────────────────────────────────────────────────────
const storagePath = configService.get().server.storagePathOverride || "./storage";
["images", "queue", "logs"].forEach((dir) => {
  const full = path.join(storagePath, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3000"] }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for locally cached images
app.use(
  "/storage/images",
  express.static(path.join(storagePath, "images"))
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/config", configRouter);
app.use("/api/ai", aiRouter);
app.use("/api/posts", postsRouter);
app.use("/api/publish", publishRouter);
app.use("/api/platforms", platformsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/analytics", analyticsRouter);

// Health check
app.get("/health", (_req, res) => {
  const cfg = configService.get();
  res.json({
    status: "ok",
    version: "1.0.0",
    services: {
      notion: configService.isNotionConfigured(),
      scheduler: cfg.scheduler.enabled,
    },
  });
});

// ── Scheduler publish function ────────────────────────────────────────────────
async function schedulerPublish(notionPageId: string, platforms: string[]) {
  if (!configService.isNotionConfigured()) {
    throw new Error("Notion not configured. Go to Settings to add your credentials.");
  }

  const notion = new Client({ auth: configService.getNotionApiKey() });
  const n2m = new NotionToMarkdown({ notionClient: notion });

  const page = await notion.pages.retrieve({ page_id: notionPageId });
  if (!("properties" in page)) throw new Error("Page not found");

  const props = (page as any).properties;
  const getText = (prop: any) =>
    prop?.type === "title"
      ? prop.title?.map((t: any) => t.plain_text).join("") ?? ""
      : prop?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";

  const mdBlocks = await n2m.pageToMarkdown(notionPageId);
  const mdResult = n2m.toMarkdownString(mdBlocks);

  const payload: PublishPayload = {
    title: getText(props["Title"]),
    content_markdown: mdResult.parent,
    tags: props["Tags"]?.multi_select?.map((s: any) => s.name) ?? [],
    canonical_url: props["Canonical URL"]?.url ?? null,
    cover_image_url:
      props["Cover Image"]?.files?.[0]?.file?.url ??
      props["Cover Image"]?.files?.[0]?.external?.url ??
      null,
    excerpt: getText(props["Excerpt"]),
    slug: getText(props["Slug"]),
  };

  const PUBLISHERS: Record<string, (p: PublishPayload) => Promise<any>> = {
    devto: publishToDevto,
    hashnode: publishToHashnode,
  };

  for (const platform of platforms) {
    const publisher = PUBLISHERS[platform];
    if (!publisher) continue;

    const result = await publisher(payload);

    // Write result to Notion Analytics DB
    const analyticsDbId = configService.getNotionAnalyticsDbId();
    if (analyticsDbId) {
      await notion.pages.create({
        parent: { database_id: analyticsDbId },
        properties: {
          Name: { title: [{ text: { content: platform } }] },
          Post: { relation: [{ id: notionPageId }] },
          Platform: { select: { name: platform } },
          Status: { select: { name: result.success ? "Success" : "Failed" } },
          "Published URL": result.url ? { url: result.url } : { url: null },
          "Error Message": {
            rich_text: [{ text: { content: result.error ?? "" } }],
          },
          "Published At": result.success
            ? { date: { start: new Date().toISOString() } }
            : { date: null },
        },
      });
    }
  }
}

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`BlogCast server running on http://localhost:${PORT}`);

  // Start scheduler if enabled and Notion is configured
  const cfg = configService.get();
  if (cfg.scheduler.enabled && configService.isNotionConfigured()) {
    startScheduler(cfg.scheduler.pollIntervalMinutes, schedulerPublish);
  } else if (!configService.isNotionConfigured()) {
    logger.warn(
      "Scheduler disabled: Notion not configured. Open the dashboard Settings page to add your credentials."
    );
  }
});

export default app;

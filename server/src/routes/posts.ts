import { Router } from "express";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import { configService } from "../services/configService.js";
import { logger } from "../utils/logger.js";

export const postsRouter = Router();

function getNotionClient() {
  const apiKey = configService.getNotionApiKey();
  if (!apiKey) throw new Error("Notion API key not configured. Go to Settings to add it.");
  return new Client({ auth: apiKey });
}

function getPostsDbId() {
  const id = configService.getNotionPostsDbId();
  if (!id) throw new Error("Notion Posts DB ID not configured. Go to Settings to add it.");
  return id;
}

function getAnalyticsDbId() {
  const id = configService.getNotionAnalyticsDbId();
  if (!id) throw new Error("Notion Analytics DB ID not configured. Go to Settings to add it.");
  return id;
}

function mapPage(page: PageObjectResponse) {
  // Cast to any to avoid Notion SDK discriminated union narrowing
  const props = page.properties as Record<string, any>;

  const getText = (prop: any) =>
    prop?.type === "title"
      ? prop.title?.map((t: any) => t.plain_text).join("") ?? ""
      : prop?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";

  return {
    id: page.id,
    title: getText(props["Title"]),
    slug: getText(props["Slug"]),
    status: props["Status"]?.select?.name ?? "Draft",
    publishTo: props["Publish To"]?.multi_select?.map((s: any) => s.name) ?? [],
    tags: props["Tags"]?.multi_select?.map((s: any) => s.name) ?? [],
    scheduledAt: props["Scheduled At"]?.date?.start ?? null,
    publishedAt: props["Published At"]?.date?.start ?? null,
    excerpt: getText(props["Excerpt"]),
    wordCount: props["Word Count"]?.number ?? null,
    lastSynced: props["Last Synced"]?.date?.start ?? null,
    lastEditedTime: page.last_edited_time,
    createdTime: page.created_time,
  };
}

// GET /api/posts — list all posts
postsRouter.get("/", async (req, res) => {
  try {
    const notion = getNotionClient();
    const { status, limit = "20" } = req.query;

    const filter = status
      ? { property: "Status", select: { equals: String(status) } }
      : undefined;

    const response = await notion.databases.query({
      database_id: getPostsDbId(),
      filter: filter as any,
      page_size: Math.min(parseInt(String(limit)), 50),
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    });

    const posts = response.results
      .filter((p): p is PageObjectResponse => "properties" in p)
      .map(mapPage);

    res.json({ posts, total: posts.length });
  } catch (err: any) {
    logger.error("GET /api/posts failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/:id — get single post
postsRouter.get("/:id", async (req, res) => {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: req.params.id });

    if (!("properties" in page)) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json(mapPage(page as PageObjectResponse));
  } catch (err: any) {
    logger.error("GET /api/posts/:id failed", { error: err.message });
    res.status(404).json({ error: err.message });
  }
});

// GET /api/posts/:id/status — get analytics for a post
postsRouter.get("/:id/status", async (req, res) => {
  try {
    const notion = getNotionClient();

    const response = await notion.databases.query({
      database_id: getAnalyticsDbId(),
      filter: {
        property: "Post",
        relation: { contains: req.params.id },
      },
    });

    const analytics = response.results
      .filter((p): p is PageObjectResponse => "properties" in p)
      .map((page) => {
        const props = page.properties as Record<string, any>;
        return {
          id: page.id,
          platform: props["Platform"]?.select?.name ?? "",
          status: props["Status"]?.select?.name ?? "Pending",
          publishedUrl: props["Published URL"]?.url ?? null,
          errorMessage:
            props["Error Message"]?.rich_text
              ?.map((t: any) => t.plain_text)
              .join("") ?? null,
          publishedAt: props["Published At"]?.date?.start ?? null,
          reactions: props["Reactions"]?.number ?? null,
          pageViews: props["Page Views"]?.number ?? null,
          comments: props["Comments"]?.number ?? null,
        };
      });

    res.json({ postId: req.params.id, analytics });
  } catch (err: any) {
    logger.error("GET /api/posts/:id/status failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

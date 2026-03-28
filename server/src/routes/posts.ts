import { Router } from "express";
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { markdownToBlocks } from "@tryfabric/martian";
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

  // Find the title property by type — resilient to any column name
  const titleProp = Object.values(props).find((p: any) => p?.type === "title");

  return {
    id: page.id,
    title: getText(titleProp ?? props["Title"] ?? props["Name"]),
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

// GET /api/posts/:id/content — return full Markdown content of a post
postsRouter.get("/:id/content", async (req, res) => {
  try {
    const notion = getNotionClient();
    const n2m = new NotionToMarkdown({ notionClient: notion });
    const mdBlocks = await n2m.pageToMarkdown(req.params.id);
    const { parent: markdown } = n2m.toMarkdownString(mdBlocks);
    res.json({ markdown: markdown ?? "" });
  } catch (err: any) {
    logger.error("GET /api/posts/:id/content failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts — create a new post in Notion from the in-app editor
postsRouter.post("/", async (req, res) => {
  const {
    title,
    content_markdown,
    tags = [],
    excerpt = "",
    slug: slugInput,
    status = "Draft",
    publishTo = [],
    canonicalUrl,
  } = req.body;

  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  if (!content_markdown?.trim()) {
    res.status(400).json({ error: "content_markdown is required" });
    return;
  }

  // Auto-generate slug from title if not provided
  const slug =
    slugInput?.trim() ||
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 100);

  // Word count
  const wordCount = content_markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*`~>\-_]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;

  try {
    const notion = getNotionClient();
    const postsDbId = getPostsDbId();

    // Find the actual name of the title property (may be "Name", "Title", etc.)
    const db = await notion.databases.retrieve({ database_id: postsDbId });
    const titlePropName =
      Object.entries(db.properties).find(([, p]) => p.type === "title")?.[0] ?? "Title";

    // Create Notion page with properties
    const page = await notion.pages.create({
      parent: { database_id: postsDbId },
      properties: {
        [titlePropName]: { title: [{ text: { content: title } }] },
        Slug: { rich_text: [{ text: { content: slug } }] },
        Status: { select: { name: status } },
        Excerpt: excerpt
          ? { rich_text: [{ text: { content: excerpt.slice(0, 2000) } }] }
          : { rich_text: [] },
        Tags: {
          multi_select: tags.map((t: string) => ({ name: t.trim() })),
        },
        "Publish To": {
          multi_select: publishTo.map((p: string) => ({ name: p })),
        },
        "Word Count": { number: wordCount },
        ...(canonicalUrl ? { "Canonical URL": { url: canonicalUrl } } : {}),
      },
    });

    // Append content blocks (Markdown → Notion blocks via @tryfabric/martian)
    if (content_markdown.trim()) {
      const blocks = markdownToBlocks(content_markdown);
      // Notion API allows max 100 blocks per request
      const CHUNK = 100;
      for (let i = 0; i < blocks.length; i += CHUNK) {
        await notion.blocks.children.append({
          block_id: page.id,
          children: blocks.slice(i, i + CHUNK) as any,
        });
      }
    }

    const fullPage = await notion.pages.retrieve({ page_id: page.id });
    const mapped = mapPage(fullPage as PageObjectResponse);

    logger.info(`Created post in Notion: "${title}" (${page.id})`);
    res.status(201).json({ id: page.id, post: mapped });
  } catch (err: any) {
    logger.error("POST /api/posts failed", { error: err.message });
    res.status(500).json({ error: err.message });
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

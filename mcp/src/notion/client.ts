import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import type {
  NotionPost,
  PostStatus,
  Platform,
  AnalyticsStatus,
  AnalyticsEntry,
  PublishResult,
} from "../types/index.js";
import { POSTS_DB_PROPERTIES, ANALYTICS_DB_PROPERTIES } from "./schema.js";

export class NotionClient {
  private client: Client;
  private postsDbId: string;
  private analyticsDbId: string;

  constructor() {
    const apiKey = process.env.NOTION_API_KEY;
    const postsDbId = process.env.NOTION_POSTS_DB_ID;
    const analyticsDbId = process.env.NOTION_ANALYTICS_DB_ID;

    if (!apiKey || !postsDbId || !analyticsDbId) {
      throw new Error(
        "Missing required environment variables: NOTION_API_KEY, NOTION_POSTS_DB_ID, NOTION_ANALYTICS_DB_ID"
      );
    }

    this.client = new Client({ auth: apiKey });
    this.postsDbId = postsDbId;
    this.analyticsDbId = analyticsDbId;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private extractText(property: any): string {
    if (!property) return "";
    if (property.type === "title") {
      return property.title?.map((t: any) => t.plain_text).join("") ?? "";
    }
    if (property.type === "rich_text") {
      return property.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
    }
    return "";
  }

  private extractSelect(property: any): string | null {
    return property?.select?.name ?? null;
  }

  private extractMultiSelect(property: any): string[] {
    return property?.multi_select?.map((s: any) => s.name) ?? [];
  }

  private extractDate(property: any): string | null {
    return property?.date?.start ?? null;
  }

  private extractUrl(property: any): string | null {
    return property?.url ?? null;
  }

  private extractNumber(property: any): number | null {
    return property?.number ?? null;
  }

  private extractFiles(property: any): string | null {
    const files = property?.files ?? [];
    if (files.length === 0) return null;
    const file = files[0];
    return file.type === "external" ? file.external?.url : file.file?.url;
  }

  private mapPageToPost(page: PageObjectResponse): NotionPost {
    const props = page.properties;
    const p = POSTS_DB_PROPERTIES;

    return {
      id: page.id,
      title: this.extractText(props[p.title]),
      slug: this.extractText(props[p.slug]),
      status: (this.extractSelect(props[p.status]) ?? "Draft") as PostStatus,
      publishTo: this.extractMultiSelect(props[p.publishTo]) as Platform[],
      scheduledAt: this.extractDate(props[p.scheduledAt]),
      tags: this.extractMultiSelect(props[p.tags]),
      canonicalUrl: this.extractUrl(props[p.canonicalUrl]),
      coverImage: this.extractFiles(props[p.coverImage]),
      excerpt: this.extractText(props[p.excerpt]),
      publishedAt: this.extractDate(props[p.publishedAt]),
      wordCount: this.extractNumber(props[p.wordCount]),
      lastSynced: this.extractDate(props[p.lastSynced]),
      lastEditedTime: page.last_edited_time,
      createdTime: page.created_time,
    };
  }

  // ── Posts DB ─────────────────────────────────────────────────────────────

  async queryPosts(filter?: object, limit = 10): Promise<NotionPost[]> {
    const response = await this.client.databases.query({
      database_id: this.postsDbId,
      filter: filter as any,
      page_size: limit,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    });

    return response.results
      .filter((p): p is PageObjectResponse => "properties" in p)
      .map((p) => this.mapPageToPost(p));
  }

  async getPostById(pageId: string): Promise<NotionPost> {
    const page = await this.client.pages.retrieve({ page_id: pageId });
    if (!("properties" in page)) {
      throw new Error(`Page ${pageId} is not a full page object`);
    }
    return this.mapPageToPost(page as PageObjectResponse);
  }

  async getPostBySlug(slug: string): Promise<NotionPost | null> {
    const posts = await this.queryPosts({
      property: POSTS_DB_PROPERTIES.slug,
      rich_text: { equals: slug },
    });
    return posts[0] ?? null;
  }

  async updatePostStatus(pageId: string, status: PostStatus): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        [POSTS_DB_PROPERTIES.status]: { select: { name: status } },
      },
    });
  }

  async updatePostPublishedAt(pageId: string, date: string): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        [POSTS_DB_PROPERTIES.publishedAt]: { date: { start: date } },
        [POSTS_DB_PROPERTIES.status]: { select: { name: "Published" } },
      },
    });
  }

  async updatePostSchedule(
    pageId: string,
    publishAt: string,
    platforms: Platform[]
  ): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        [POSTS_DB_PROPERTIES.scheduledAt]: { date: { start: publishAt } },
        [POSTS_DB_PROPERTIES.status]: { select: { name: "Scheduled" } },
        [POSTS_DB_PROPERTIES.publishTo]: {
          multi_select: platforms.map((p) => ({ name: p })),
        },
      },
    });
  }

  async updateLastSynced(pageId: string): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        [POSTS_DB_PROPERTIES.lastSynced]: {
          date: { start: new Date().toISOString() },
        },
      },
    });
  }

  // ── Analytics DB ─────────────────────────────────────────────────────────

  private mapPageToAnalytics(page: PageObjectResponse): AnalyticsEntry {
    const props = page.properties;
    const p = ANALYTICS_DB_PROPERTIES;

    const postRelation = props[p.post] as any;
    const postId = postRelation?.relation?.[0]?.id ?? "";

    return {
      id: page.id,
      postId,
      platform: (this.extractSelect(props[p.platform]) ?? "") as Platform,
      status: (this.extractSelect(props[p.status]) ?? "Pending") as AnalyticsStatus,
      publishedUrl: this.extractUrl(props[p.publishedUrl]),
      errorMessage: this.extractText(props[p.errorMessage]),
      publishedAt: this.extractDate(props[p.publishedAt]),
      reactions: this.extractNumber(props[p.reactions]),
      pageViews: this.extractNumber(props[p.pageViews]),
      comments: this.extractNumber(props[p.comments]),
    };
  }

  async getAnalyticsForPost(postId: string): Promise<AnalyticsEntry[]> {
    const response = await this.client.databases.query({
      database_id: this.analyticsDbId,
      filter: {
        property: ANALYTICS_DB_PROPERTIES.post,
        relation: { contains: postId },
      },
    });

    return response.results
      .filter((p): p is PageObjectResponse => "properties" in p)
      .map((p) => this.mapPageToAnalytics(p));
  }

  async upsertAnalytics(
    postId: string,
    result: PublishResult
  ): Promise<void> {
    const p = ANALYTICS_DB_PROPERTIES;
    const now = new Date().toISOString();

    // Check for existing entry for this post + platform
    const existing = await this.client.databases.query({
      database_id: this.analyticsDbId,
      filter: {
        and: [
          { property: p.post, relation: { contains: postId } },
          { property: p.platform, select: { equals: result.platform } },
        ],
      },
    });

    const properties: Record<string, any> = {
      [p.platform]: { select: { name: result.platform } },
      [p.status]: {
        select: { name: result.success ? "Success" : "Failed" },
      },
      [p.publishedUrl]: result.url ? { url: result.url } : { url: null },
      [p.errorMessage]: {
        rich_text: [
          {
            text: { content: result.error ?? "" },
          },
        ],
      },
      [p.publishedAt]: result.success ? { date: { start: now } } : { date: null },
    };

    if (existing.results.length > 0) {
      await this.client.pages.update({
        page_id: existing.results[0].id,
        properties,
      });
    } else {
      await this.client.pages.create({
        parent: { database_id: this.analyticsDbId },
        properties: {
          ...properties,
          // Title is required — use "PostTitle / Platform"
          Name: {
            title: [{ text: { content: `${result.platform}` } }],
          },
          [p.post]: { relation: [{ id: postId }] },
        },
      });
    }
  }

  async updateAnalyticsStats(
    entryId: string,
    stats: { reactions?: number; pageViews?: number; comments?: number }
  ): Promise<void> {
    const p = ANALYTICS_DB_PROPERTIES;
    const properties: Record<string, any> = {};

    if (stats.reactions !== undefined) {
      properties[p.reactions] = { number: stats.reactions };
    }
    if (stats.pageViews !== undefined) {
      properties[p.pageViews] = { number: stats.pageViews };
    }
    if (stats.comments !== undefined) {
      properties[p.comments] = { number: stats.comments };
    }

    await this.client.pages.update({ page_id: entryId, properties });
  }

  // ── Page blocks (for content fetching) ───────────────────────────────────

  async getPageBlocks(pageId: string): Promise<any[]> {
    const blocks: any[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        start_cursor: cursor,
      });

      blocks.push(...response.results);
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return blocks;
  }
}

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import { publishToDevto } from "../publishers/devto.js";
import { publishToHashnode } from "../publishers/hashnode.js";
import { configService } from "./configService.js";
import { logger } from "../utils/logger.js";
import type { PublishPayload, PublishResult } from "../publishers/types.js";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

// Inline minimal Notion client for the scheduler (avoids circular deps)
async function fetchScheduledPosts(notion: Client, dbId: string) {
  const now = new Date().toISOString();

  const response = await notion.databases.query({
    database_id: dbId,
    filter: {
      and: [
        { property: "Status", select: { equals: "Scheduled" } },
        { property: "Scheduled At", date: { on_or_before: now } },
      ],
    },
  });

  return response.results.filter(
    (p): p is PageObjectResponse => "properties" in p
  );
}

function extractText(property: any): string {
  if (property?.type === "title")
    return property.title?.map((t: any) => t.plain_text).join("") ?? "";
  if (property?.type === "rich_text")
    return property.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
  return "";
}

export function startScheduler(
  intervalMinutes: number,
  publishFn: (notionPageId: string, platforms: string[]) => Promise<void>
) {
  if (!configService.isNotionConfigured()) {
    logger.warn("Scheduler disabled: Notion not configured. Use the Settings page to add credentials.");
    return;
  }

  const notion = new Client({ auth: configService.getNotionApiKey() });
  const dbId = configService.getNotionPostsDbId();

  const intervalMs = intervalMinutes * 60 * 1000;

  logger.info(
    `Scheduler started — checking every ${intervalMinutes} minute(s)`
  );

  schedulerInterval = setInterval(async () => {
    try {
      const posts = await fetchScheduledPosts(notion, dbId);

      if (posts.length === 0) return;

      logger.info(`Scheduler found ${posts.length} post(s) due for publishing`);

      for (const page of posts) {
        const props = page.properties as Record<string, any>;
        const platforms: string[] =
          props["Publish To"]?.multi_select?.map((s: any) => s.name) ?? [];

        if (platforms.length === 0) {
          logger.warn(`Scheduled post ${page.id} has no platforms set — skipping`);
          continue;
        }

        try {
          await publishFn(page.id, platforms);

          // Update status to Published
          await notion.pages.update({
            page_id: page.id,
            properties: {
              Status: { select: { name: "Published" } },
              "Published At": { date: { start: new Date().toISOString() } },
            },
          });
        } catch (err: any) {
          logger.error(`Scheduler publish failed for ${page.id}`, {
            error: err.message,
          });

          await notion.pages.update({
            page_id: page.id,
            properties: {
              Status: { select: { name: "Failed" } },
            },
          });
        }
      }
    } catch (err: any) {
      logger.error("Scheduler error", { error: err.message });
    }
  }, intervalMs);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("Scheduler stopped");
  }
}

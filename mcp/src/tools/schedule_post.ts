import { z } from "zod";
import type { NotionClient } from "../notion/client.js";
import type { Platform } from "../types/index.js";

export const schedulePostSchema = z.object({
  post_id: z
    .string()
    .min(1)
    .describe("Notion page ID or slug of the post to schedule."),
  publish_at: z
    .string()
    .describe(
      "ISO 8601 datetime string for when to publish (e.g. '2025-03-01T09:00:00Z')."
    ),
  platforms: z
    .array(
      z.enum(["devto", "hashnode", "medium", "linkedin", "ghost", "wordpress"])
    )
    .optional()
    .describe(
      "Platforms to publish to when scheduled time arrives. Defaults to existing 'Publish To' field."
    ),
});

export type SchedulePostInput = z.infer<typeof schedulePostSchema>;

export async function schedulePost(
  input: SchedulePostInput,
  notion: NotionClient
): Promise<string> {
  const { post_id, publish_at, platforms } = input;

  // Validate datetime
  const publishDate = new Date(publish_at);
  if (isNaN(publishDate.getTime())) {
    return `Invalid datetime: "${publish_at}". Use ISO 8601 format, e.g. "2025-03-01T09:00:00Z".`;
  }

  if (publishDate <= new Date()) {
    return `Scheduled time "${publish_at}" is in the past. Please provide a future datetime.`;
  }

  // Resolve post
  let post = null;
  try {
    post = await notion.getPostById(post_id);
  } catch {
    post = await notion.getPostBySlug(post_id);
  }

  if (!post) {
    return `Post not found: "${post_id}".`;
  }

  const targetPlatforms = (platforms as Platform[] | undefined) ?? post.publishTo;

  if (targetPlatforms.length === 0) {
    return (
      `No platforms specified for scheduling. ` +
      `Set the 'Publish To' property in Notion or pass platforms explicitly.`
    );
  }

  await notion.updatePostSchedule(post.id, publish_at, targetPlatforms);

  return [
    `**Scheduled: ${post.title}**`,
    ``,
    `Will publish to: ${targetPlatforms.join(", ")}`,
    `Scheduled for: ${publishDate.toLocaleString()}`,
    ``,
    `The BlogCast scheduler (running in the backend) will publish this post automatically.`,
    `Make sure the server is running: \`npm run dev:server\``,
  ].join("\n");
}

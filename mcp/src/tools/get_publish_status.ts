import { z } from "zod";
import type { NotionClient } from "../notion/client.js";

export const getPublishStatusSchema = z.object({
  post_id: z
    .string()
    .min(1)
    .describe("Notion page ID or slug of the post to check."),
});

export type GetPublishStatusInput = z.infer<typeof getPublishStatusSchema>;

export async function getPublishStatus(
  input: GetPublishStatusInput,
  notion: NotionClient
): Promise<string> {
  const { post_id } = input;

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

  const analytics = await notion.getAnalyticsForPost(post.id);

  if (analytics.length === 0) {
    return (
      `**${post.title}** — No publish history found.\n` +
      `Status: ${post.status}\n` +
      `Use publish_post to publish this post.`
    );
  }

  const statusEmoji: Record<string, string> = {
    Success: "✅",
    Failed: "❌",
    Pending: "⏳",
  };

  const lines = [
    `**Publish status for: ${post.title}**`,
    `Overall status: ${post.status}`,
    ``,
    ...analytics.map((entry) => {
      const emoji = statusEmoji[entry.status] ?? "❓";
      const parts = [
        `${emoji} **${entry.platform}** — ${entry.status}`,
        entry.publishedUrl ? `   URL: ${entry.publishedUrl}` : "",
        entry.publishedAt
          ? `   Published: ${new Date(entry.publishedAt).toLocaleString()}`
          : "",
        entry.errorMessage ? `   Error: ${entry.errorMessage}` : "",
        entry.reactions != null ? `   Reactions: ${entry.reactions}` : "",
        entry.pageViews != null ? `   Views: ${entry.pageViews}` : "",
        entry.comments != null ? `   Comments: ${entry.comments}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return parts;
    }),
  ];

  return lines.join("\n");
}

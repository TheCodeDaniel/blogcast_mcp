import { z } from "zod";
import type { NotionClient } from "../notion/client.js";
import type { PostStatus } from "../types/index.js";

export const listDraftsSchema = z.object({
  status: z
    .enum(["Draft", "Review", "Scheduled", "all"])
    .default("Draft")
    .describe("Filter posts by status. Use 'all' to see every post."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of posts to return (1–50)."),
});

export type ListDraftsInput = z.infer<typeof listDraftsSchema>;

export async function listDrafts(
  input: ListDraftsInput,
  notion: NotionClient
): Promise<string> {
  const { status, limit } = input;

  const filter =
    status === "all"
      ? undefined
      : {
          property: "Status",
          select: { equals: status as PostStatus },
        };

  const posts = await notion.queryPosts(filter, limit);

  if (posts.length === 0) {
    return `No posts found with status: ${status}`;
  }

  const lines = posts.map((post, i) => {
    const tags = post.tags.length > 0 ? post.tags.join(", ") : "none";
    const wordCount = post.wordCount ? `${post.wordCount} words` : "unknown length";
    const platforms =
      post.publishTo.length > 0 ? post.publishTo.join(", ") : "none selected";
    const edited = new Date(post.lastEditedTime).toLocaleDateString();

    return [
      `${i + 1}. **${post.title || "(Untitled)"}**`,
      `   ID: ${post.id}`,
      `   Slug: ${post.slug || "(none)"}`,
      `   Status: ${post.status}`,
      `   Tags: ${tags}`,
      `   Length: ${wordCount}`,
      `   Publish to: ${platforms}`,
      `   Last edited: ${edited}`,
      post.scheduledAt ? `   Scheduled: ${post.scheduledAt}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `Found ${posts.length} post(s) with status "${status}":\n\n${lines.join("\n\n")}`;
}

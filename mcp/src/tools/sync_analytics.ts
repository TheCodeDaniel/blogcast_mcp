import { z } from "zod";
import axios from "axios";
import type { NotionClient } from "../notion/client.js";

export const syncAnalyticsSchema = z.object({
  post_id: z
    .string()
    .optional()
    .describe(
      "Specific Notion page ID or slug to sync. Omit to sync all published posts."
    ),
});

export type SyncAnalyticsInput = z.infer<typeof syncAnalyticsSchema>;

export async function syncAnalytics(
  input: SyncAnalyticsInput,
  notion: NotionClient
): Promise<string> {
  const { post_id } = input;
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";

  let postIds: string[] = [];

  if (post_id) {
    // Single post
    let post = null;
    try {
      post = await notion.getPostById(post_id);
    } catch {
      post = await notion.getPostBySlug(post_id);
    }

    if (!post) {
      return `Post not found: "${post_id}".`;
    }

    postIds = [post.id];
  } else {
    // All published posts
    const posts = await notion.queryPosts(
      { property: "Status", select: { equals: "Published" } },
      50
    );
    postIds = posts.map((p) => p.id);

    if (postIds.length === 0) {
      return "No published posts found to sync.";
    }
  }

  // Ask the backend to pull fresh stats and update analytics entries
  try {
    const response = await axios.post(
      `${backendUrl}/api/analytics/sync`,
      { post_ids: postIds },
      { timeout: 60_000 }
    );

    const { synced, errors } = response.data as {
      synced: number;
      errors: Array<{ postId: string; platform: string; error: string }>;
    };

    // Update Notion last_synced timestamps
    await Promise.allSettled(postIds.map((id) => notion.updateLastSynced(id)));

    const lines = [
      `**Analytics sync complete**`,
      ``,
      `Posts synced: ${postIds.length}`,
      `Platform entries updated: ${synced}`,
    ];

    if (errors.length > 0) {
      lines.push(``, `**Errors (${errors.length}):**`);
      errors.forEach((e) => {
        lines.push(`  ❌ ${e.platform} for ${e.postId}: ${e.error}`);
      });
    }

    return lines.join("\n");
  } catch (err: any) {
    const msg = err.response?.data?.error ?? err.message ?? "Unknown error";
    return `Failed to sync analytics.\nError: ${msg}\n\nMake sure the backend is running: \`npm run dev:server\``;
  }
}

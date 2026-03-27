import { z } from "zod";
import axios from "axios";
import type { NotionClient } from "../notion/client.js";
import type { NotionParser } from "../notion/parser.js";
import type { Platform, PublishResult } from "../types/index.js";

export const publishPostSchema = z.object({
  post_id: z
    .string()
    .min(1)
    .describe("Notion page ID or slug of the post to publish."),
  platforms: z
    .array(
      z.enum(["devto", "hashnode", "medium", "linkedin", "ghost", "wordpress"])
    )
    .optional()
    .describe(
      "Override which platforms to publish to. Defaults to the 'Publish To' field on the Notion page."
    ),
  dry_run: z
    .boolean()
    .default(false)
    .describe(
      "If true, validates the post and shows what would be published without actually publishing."
    ),
});

export type PublishPostInput = z.infer<typeof publishPostSchema>;

export async function publishPost(
  input: PublishPostInput,
  notion: NotionClient,
  parser: NotionParser
): Promise<string> {
  const { post_id, platforms: platformOverride, dry_run } = input;

  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";

  // ── Fetch post ────────────────────────────────────────────────────────────
  let post = null;
  try {
    post = await notion.getPostById(post_id);
  } catch {
    post = await notion.getPostBySlug(post_id);
  }

  if (!post) {
    return `Post not found: "${post_id}". Provide a valid Notion page ID or slug.`;
  }

  // ── Resolve target platforms ──────────────────────────────────────────────
  const targetPlatforms: Platform[] =
    platformOverride && platformOverride.length > 0
      ? (platformOverride as Platform[])
      : post.publishTo;

  if (targetPlatforms.length === 0) {
    return (
      `Post "${post.title}" has no target platforms configured.\n` +
      `Set the 'Publish To' property in Notion, or pass platforms explicitly.`
    );
  }

  // ── Fetch content ─────────────────────────────────────────────────────────
  const markdownContent = await parser.pageToMarkdown(post.id);
  const wordCount = parser.countWords(markdownContent);

  if (dry_run) {
    const imageUrls = parser.extractImageUrls(markdownContent);
    return [
      `**[DRY RUN] Publish preview for: ${post.title}**`,
      ``,
      `Would publish to: ${targetPlatforms.join(", ")}`,
      `Word count: ${wordCount}`,
      `Images found: ${imageUrls.length}`,
      `Tags: ${post.tags.join(", ") || "none"}`,
      `Excerpt: ${post.excerpt || "(none)"}`,
      `Canonical URL: ${post.canonicalUrl || "(none)"}`,
      `Cover image: ${post.coverImage || "(none)"}`,
      ``,
      `No changes were made. Run without dry_run to publish.`,
    ].join("\n");
  }

  // ── Send to backend ───────────────────────────────────────────────────────
  let results: PublishResult[];

  try {
    const response = await axios.post<{ results: PublishResult[] }>(
      `${backendUrl}/api/publish`,
      {
        post: {
          title: post.title,
          content_markdown: markdownContent,
          tags: post.tags,
          canonical_url: post.canonicalUrl,
          cover_image_url: post.coverImage,
          excerpt: post.excerpt,
          slug: post.slug,
        },
        platforms: targetPlatforms,
        notion_page_id: post.id,
      },
      { timeout: 60_000 }
    );

    results = response.data.results;
  } catch (err: any) {
    const msg =
      err.response?.data?.error ??
      err.message ??
      "Unknown error contacting backend";
    return `Failed to reach BlogCast backend at ${backendUrl}.\nError: ${msg}\n\nMake sure the server is running: \`npm run dev:server\``;
  }

  // ── Write results back to Notion Analytics DB ────────────────────────────
  await Promise.allSettled(
    results.map((result) => notion.upsertAnalytics(post.id, result))
  );

  // ── Update post status ────────────────────────────────────────────────────
  const allSucceeded = results.every((r) => r.success);
  const anySucceeded = results.some((r) => r.success);

  if (allSucceeded) {
    await notion.updatePostPublishedAt(post.id, new Date().toISOString());
  } else if (!anySucceeded) {
    await notion.updatePostStatus(post.id, "Failed");
  }
  // partial success: leave status as-is (some platforms succeeded)

  // ── Format output ─────────────────────────────────────────────────────────
  const lines = [
    `**Publish results for: ${post.title}**`,
    ``,
    ...results.map((r) => {
      if (r.success) {
        return `✅ **${r.platform}** — Published successfully\n   URL: ${r.url}`;
      } else {
        return `❌ **${r.platform}** — Failed\n   Error: ${r.error}`;
      }
    }),
    ``,
    `Analytics logged to Notion.`,
    allSucceeded
      ? `Post status updated to **Published**.`
      : anySucceeded
      ? `Post partially published (some platforms failed).`
      : `Post status updated to **Failed**.`,
  ];

  return lines.join("\n");
}

import { z } from "zod";
import type { NotionClient } from "../notion/client.js";
import type { NotionParser } from "../notion/parser.js";

export const previewPostSchema = z.object({
  post_id: z
    .string()
    .min(1)
    .describe("Notion page ID or slug of the post to preview."),
});

export type PreviewPostInput = z.infer<typeof previewPostSchema>;

export async function previewPost(
  input: PreviewPostInput,
  notion: NotionClient,
  parser: NotionParser
): Promise<string> {
  const { post_id } = input;

  // Try as page ID first, then as slug
  let post = null;
  try {
    post = await notion.getPostById(post_id);
  } catch {
    post = await notion.getPostBySlug(post_id);
  }

  if (!post) {
    return `Post not found: "${post_id}". Provide a valid Notion page ID or slug.`;
  }

  const markdown = await parser.pageToMarkdown(post.id);
  const wordCount = parser.countWords(markdown);
  const imageUrls = parser.extractImageUrls(markdown);

  const meta = [
    `# ${post.title}`,
    ``,
    `**ID:** ${post.id}`,
    `**Slug:** ${post.slug || "(none)"}`,
    `**Status:** ${post.status}`,
    `**Tags:** ${post.tags.length > 0 ? post.tags.join(", ") : "none"}`,
    `**Excerpt:** ${post.excerpt || "(none)"}`,
    `**Canonical URL:** ${post.canonicalUrl || "(none)"}`,
    `**Cover image:** ${post.coverImage || "(none)"}`,
    `**Word count:** ${wordCount}`,
    `**Images in content:** ${imageUrls.length}`,
    `**Publish to:** ${post.publishTo.length > 0 ? post.publishTo.join(", ") : "not set"}`,
    ``,
    `---`,
    ``,
    `## Content Preview`,
    ``,
    markdown.slice(0, 3000) + (markdown.length > 3000 ? "\n\n... *(truncated — full content will be used when publishing)*" : ""),
  ].join("\n");

  return meta;
}

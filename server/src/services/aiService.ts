import Anthropic from "@anthropic-ai/sdk";
import { configService } from "./configService.js";
import { logger } from "../utils/logger.js";

function getClient(): Anthropic {
  const key = configService.getAnthropicApiKey();
  if (!key) throw new Error("Anthropic API key not configured. Add it in Settings.");
  return new Anthropic({ apiKey: key });
}

// ── Pre-publish quality check ─────────────────────────────────────────────────

export async function checkPrePublish(post: {
  title: string;
  content: string;
  tags: string[];
  excerpt: string;
}): Promise<string[]> {
  const client = getClient();

  const prompt = `You are a technical blog editor. Review this blog post and return a JSON array of short, actionable warning strings for any issues you find. Return an empty array [] if everything looks good.

Check for:
- Title is too vague or too long (over 80 chars)
- Missing or very short excerpt (under 50 chars)
- No tags provided
- Content is very short (under 300 words)
- Broken markdown (unclosed code blocks, malformed headers)
- Starts abruptly without an introduction
- Ends without a conclusion or call to action
- Content appears to be placeholder/template text

Post details:
Title: ${post.title}
Tags: ${post.tags.join(", ") || "(none)"}
Excerpt: ${post.excerpt || "(none)"}
Word count: ${post.content.split(/\s+/).filter(Boolean).length}

Content (first 2000 chars):
${post.content.slice(0, 2000)}

Return ONLY a valid JSON array of strings. No explanation, no markdown. Example: ["Title is too vague", "Missing conclusion"]`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err: any) {
    logger.error("AI pre-publish check failed", { error: err.message });
    return [];
  }
}

// ── Generate excerpt and tags ─────────────────────────────────────────────────

export async function generateExcerptAndTags(post: {
  title: string;
  content: string;
}): Promise<{ excerpt: string; tags: string[] }> {
  const client = getClient();

  const prompt = `You are a technical blog editor. Generate an excerpt and tags for this blog post.

Return a JSON object with exactly this shape:
{
  "excerpt": "A compelling 1-2 sentence summary (max 160 chars) that would make readers want to read more",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}

Rules:
- Excerpt: plain text only, no markdown, max 160 characters, hook the reader
- Tags: 3-5 lowercase tags, relevant to the content, suitable for Dev.to/Hashnode (e.g. "javascript", "webdev", "tutorial")
- Tags must be single words or hyphenated (e.g. "react", "type-safety", "open-source")

Post title: ${post.title}

Content (first 3000 chars):
${post.content.slice(0, 3000)}

Return ONLY the JSON object. No explanation, no markdown fences.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const parsed = JSON.parse(text);
    return {
      excerpt: typeof parsed.excerpt === "string" ? parsed.excerpt.slice(0, 160) : "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
    };
  } catch (err: any) {
    logger.error("AI excerpt/tags generation failed", { error: err.message });
    return { excerpt: "", tags: [] };
  }
}

// ── Per-platform content adaptation ──────────────────────────────────────────

export async function adaptContentForPlatform(
  content: string,
  platform: "devto" | "hashnode" | "medium",
  post: { title: string; tags: string[] }
): Promise<string> {
  const client = getClient();

  const platformGuide: Record<string, string> = {
    devto: `Dev.to audience: developers who like practical tutorials, code-first posts.
- Keep the Markdown as-is — Dev.to renders standard Markdown
- Add a brief "## TL;DR" section at the top if the post is over 500 words
- Ensure code blocks have language hints (e.g. \`\`\`typescript)
- Keep it conversational and direct`,
    hashnode: `Hashnode audience: developers and tech professionals.
- Keep the Markdown as-is — Hashnode renders standard Markdown
- Ensure headings are well-structured (H2 for main sections, H3 for sub-sections)
- Ensure code blocks have language hints
- Keep the professional yet approachable tone`,
    medium: `Medium audience: broader tech/business readers, not just developers.
- Convert the Markdown to clean HTML (Medium renders HTML)
- Use <h2>, <h3> for headings, <p> for paragraphs, <pre><code> for code blocks
- Make the intro more narrative and accessible — hook the reader in the first paragraph
- Convert bullet lists to <ul><li> HTML
- Do NOT include the post title as an H1 (Medium adds it automatically)
- Keep code samples but consider adding brief plain-English explanations around them`,
  };

  const model = platform === "medium" ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";

  const prompt = `You are adapting a blog post for ${platform}. Follow the guidelines below exactly.

Platform guidelines:
${platformGuide[platform]}

Post title: ${post.title}
Tags: ${post.tags.join(", ")}

Original content:
${content}

Return ONLY the adapted content. No preamble, no explanation, no markdown fences around the whole response.`;

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const adapted = message.content[0].type === "text" ? message.content[0].text : content;
    logger.info(`AI adapted content for ${platform} (${adapted.length} chars)`);
    return adapted;
  } catch (err: any) {
    logger.error(`AI content adaptation failed for ${platform}`, { error: err.message });
    // Degrade gracefully — return original content
    return content;
  }
}

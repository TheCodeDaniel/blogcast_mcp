import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";

export class NotionParser {
  private n2m: NotionToMarkdown;

  constructor(notionClient: Client) {
    this.n2m = new NotionToMarkdown({ notionClient });
  }

  async pageToMarkdown(pageId: string): Promise<string> {
    const mdBlocks = await this.n2m.pageToMarkdown(pageId);
    const mdString = this.n2m.toMarkdownString(mdBlocks);
    return mdString.parent;
  }

  /**
   * Extracts all image URLs from a markdown string.
   */
  extractImageUrls(markdown: string): string[] {
    const imageRegex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
    const urls: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = imageRegex.exec(markdown)) !== null) {
      urls.push(match[1]);
    }

    return [...new Set(urls)]; // deduplicate
  }

  /**
   * Replaces image URLs in markdown with new URLs (e.g., local paths or CDN URLs).
   */
  replaceImageUrls(
    markdown: string,
    urlMap: Map<string, string>
  ): string {
    let result = markdown;

    for (const [originalUrl, newUrl] of urlMap.entries()) {
      result = result.split(originalUrl).join(newUrl);
    }

    return result;
  }

  /**
   * Counts words in a markdown string (strips markdown syntax first).
   */
  countWords(markdown: string): number {
    const stripped = markdown
      .replace(/```[\s\S]*?```/g, "") // remove code blocks
      .replace(/`[^`]+`/g, "") // remove inline code
      .replace(/!\[.*?\]\(.*?\)/g, "") // remove images
      .replace(/\[.*?\]\(.*?\)/g, "$1") // replace links with text
      .replace(/[#*_~>|]/g, "") // remove markdown symbols
      .replace(/\s+/g, " ")
      .trim();

    return stripped ? stripped.split(" ").length : 0;
  }
}

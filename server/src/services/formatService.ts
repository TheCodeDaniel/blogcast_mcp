import { marked } from "marked";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

export const formatService = {
  /**
   * Converts Markdown to HTML.
   */
  markdownToHtml(markdown: string): string {
    return marked.parse(markdown) as string;
  },

  /**
   * Converts HTML to Markdown.
   */
  htmlToMarkdown(html: string): string {
    return turndown.turndown(html);
  },

  /**
   * Formats markdown for Dev.to: replaces local image paths with hosted URLs.
   */
  formatForDevto(
    markdown: string,
    imageUrlMap: Map<string, string>
  ): string {
    let result = markdown;
    for (const [original, replacement] of imageUrlMap.entries()) {
      result = result.split(original).join(replacement);
    }
    return result;
  },

  /**
   * Formats markdown for Hashnode: same as Dev.to (both accept Markdown).
   */
  formatForHashnode(
    markdown: string,
    imageUrlMap: Map<string, string>
  ): string {
    return formatService.formatForDevto(markdown, imageUrlMap);
  },

  /**
   * Formats content as HTML for platforms that require it (Medium, WP, LinkedIn).
   */
  formatAsHtml(
    markdown: string,
    imageUrlMap: Map<string, string>
  ): string {
    let result = markdown;
    for (const [original, replacement] of imageUrlMap.entries()) {
      result = result.split(original).join(replacement);
    }
    return formatService.markdownToHtml(result);
  },

  /**
   * Truncates a string to a max length, adding ellipsis if needed.
   */
  truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
  },

  /**
   * Strips markdown syntax to produce plain text.
   */
  toPlainText(markdown: string): string {
    return markdown
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/[*_~>|]/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
  },
};

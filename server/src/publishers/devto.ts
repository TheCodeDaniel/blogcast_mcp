import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { authService } from "../services/authService.js";
import { imageService } from "../services/imageService.js";
import { formatService } from "../services/formatService.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { PublishPayload, PublishResult } from "./types.js";

const BASE_URL = "https://dev.to/api";

interface DevtoArticle {
  id: number;
  url: string;
  slug: string;
  title: string;
}

async function uploadImageToDevto(
  apiKey: string,
  localPath: string,
  originalUrl: string
): Promise<string> {
  // Check if already uploaded
  const cached = imageService.getPlatformUrl(originalUrl, "devto");
  if (cached) return cached;

  const form = new FormData();
  form.append("image", fs.createReadStream(localPath), {
    filename: path.basename(localPath),
    contentType: "image/jpeg",
  });

  try {
    const response = await axios.post<{ image: [string] }>(
      `${BASE_URL}/images`,
      form,
      {
        headers: {
          "api-key": apiKey,
          ...form.getHeaders(),
        },
        timeout: 30_000,
      }
    );

    const uploadedUrl = response.data.image[0];
    imageService.savePlatformUrl(originalUrl, "devto", uploadedUrl);
    return uploadedUrl;
  } catch (err: any) {
    logger.warn(`Dev.to image upload failed, using original URL`, {
      error: err.message,
    });
    return originalUrl;
  }
}

export async function publishToDevto(
  payload: PublishPayload
): Promise<PublishResult> {
  const creds = authService.getCredentials("devto");
  if (!creds?.api_key) {
    return {
      platform: "devto",
      success: false,
      error:
        'Dev.to API key not configured. Use manage_platforms with action "add" and platform "devto".',
    };
  }

  try {
    const result = await withRetry(async () => {
      // Process images: download → upload to Dev.to CDN
      const imageUrlMap = new Map<string, string>();
      const { urlMap: localMap } = await imageService.processMarkdownImages(
        payload.content_markdown
      );

      for (const [originalUrl, localPath] of localMap.entries()) {
        if (localPath !== originalUrl && fs.existsSync(localPath)) {
          const devtoUrl = await uploadImageToDevto(
            creds.api_key,
            localPath,
            originalUrl
          );
          imageUrlMap.set(originalUrl, devtoUrl);
        } else {
          imageUrlMap.set(originalUrl, localPath);
        }
      }

      const formattedMarkdown = formatService.formatForDevto(
        payload.content_markdown,
        imageUrlMap
      );

      const articleBody: Record<string, any> = {
        article: {
          title: payload.title,
          body_markdown: formattedMarkdown,
          published: true,
          tags: payload.tags.slice(0, 4).map((t) => t.toLowerCase().replace(/\s+/g, "")),
          ...(payload.canonical_url ? { canonical_url: payload.canonical_url } : {}),
          ...(payload.excerpt ? { description: formatService.truncate(payload.excerpt, 155) } : {}),
        },
      };

      // Set cover image (must be a URL, not a local path)
      if (payload.cover_image_url) {
        const cached = imageService.getPlatformUrl(payload.cover_image_url, "devto");
        articleBody.article.main_image = cached ?? payload.cover_image_url;
      }

      const response = await axios.post<DevtoArticle>(
        `${BASE_URL}/articles`,
        articleBody,
        {
          headers: {
            "api-key": creds.api_key,
            "Content-Type": "application/json",
          },
          timeout: 30_000,
        }
      );

      return response.data;
    });

    logger.info(`Published to Dev.to: ${result.url}`);
    return { platform: "devto", success: true, url: result.url };
  } catch (err: any) {
    const error =
      err.response?.data?.error ??
      err.response?.data?.message ??
      err.message ??
      "Unknown error";
    logger.error(`Dev.to publish failed`, { error });
    return { platform: "devto", success: false, error };
  }
}

export async function testDevtoConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  const creds = authService.getCredentials("devto");
  if (!creds?.api_key) {
    return { success: false, message: "No API key configured." };
  }

  try {
    const response = await axios.get(`${BASE_URL}/users/me`, {
      headers: { "api-key": creds.api_key },
      timeout: 10_000,
    });
    return {
      success: true,
      message: `Connected as @${response.data.username}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.response?.data?.error ?? err.message,
    };
  }
}

export async function syncDevtoAnalytics(articleUrl: string): Promise<{
  reactions: number;
  pageViews: number;
  comments: number;
} | null> {
  const creds = authService.getCredentials("devto");
  if (!creds?.api_key) return null;

  try {
    // Extract article slug from URL
    const slug = articleUrl.split("/").slice(-1)[0];
    const response = await axios.get(`${BASE_URL}/articles/me`, {
      headers: { "api-key": creds.api_key },
      timeout: 10_000,
    });

    const article = response.data.find(
      (a: any) => a.slug === slug || a.url === articleUrl
    );
    if (!article) return null;

    return {
      reactions: article.public_reactions_count ?? 0,
      pageViews: article.page_views_count ?? 0,
      comments: article.comments_count ?? 0,
    };
  } catch {
    return null;
  }
}

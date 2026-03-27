import axios from "axios";
import { authService } from "../services/authService.js";
import { formatService } from "../services/formatService.js";
import { imageService } from "../services/imageService.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { PublishPayload, PublishResult } from "./types.js";

const BASE_URL = "https://api.medium.com/v1";

interface MediumUser {
  id: string;
  username: string;
  name: string;
  url: string;
}

async function getMediumUser(token: string): Promise<MediumUser> {
  const res = await axios.get<{ data: MediumUser }>(`${BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10_000,
  });
  return res.data.data;
}

export async function publishToMedium(
  payload: PublishPayload
): Promise<PublishResult> {
  const creds = authService.getCredentials("medium");
  if (!creds?.integration_token) {
    return {
      platform: "medium",
      success: false,
      error:
        'Medium integration token not configured. Use manage_platforms with action "add" and platform "medium".',
    };
  }

  try {
    const result = await withRetry(async () => {
      const user = await getMediumUser(creds.integration_token);

      // Process images — Medium accepts external image URLs in HTML
      const { urlMap } = await imageService.processMarkdownImages(
        payload.content_markdown
      );

      // Medium only accepts HTML or Markdown; HTML gives better control
      const html = formatService.formatAsHtml(payload.content_markdown, urlMap);

      const body: Record<string, any> = {
        title: payload.title,
        contentFormat: "html",
        content: html,
        // Medium API: "draft" | "public" | "unlisted"
        // NOTE: direct "public" publishing requires explicit API approval from Medium.
        // We publish as "draft" so users can review and publish manually.
        publishStatus: "draft",
        tags: payload.tags.slice(0, 5),
        ...(payload.canonical_url ? { canonicalUrl: payload.canonical_url } : {}),
      };

      const res = await axios.post<{ data: { id: string; url: string } }>(
        `${BASE_URL}/users/${user.id}/posts`,
        body,
        {
          headers: {
            Authorization: `Bearer ${creds.integration_token}`,
            "Content-Type": "application/json",
          },
          timeout: 30_000,
        }
      );

      return res.data.data;
    });

    logger.info(`Published to Medium (as draft): ${result.url}`);
    return {
      platform: "medium",
      success: true,
      url: result.url,
      // Surface the draft-only limitation clearly
      error:
        "Note: Medium published as a DRAFT. Open your Medium dashboard to make it public — Medium's API does not allow direct public publishing.",
    };
  } catch (err: any) {
    const message =
      err.response?.data?.errors?.[0]?.message ??
      err.response?.data?.message ??
      err.message ??
      "Unknown error";
    logger.error("Medium publish failed", { error: message });
    return { platform: "medium", success: false, error: message };
  }
}

export async function testMediumConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  const creds = authService.getCredentials("medium");
  if (!creds?.integration_token) {
    return { success: false, message: "No integration token configured." };
  }

  try {
    const user = await getMediumUser(creds.integration_token);
    return {
      success: true,
      message: `Connected as @${user.username} (${user.name})`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.response?.data?.errors?.[0]?.message ?? err.message,
    };
  }
}

export async function syncMediumAnalytics(_articleUrl: string): Promise<null> {
  // Medium's API does not expose per-post analytics.
  return null;
}

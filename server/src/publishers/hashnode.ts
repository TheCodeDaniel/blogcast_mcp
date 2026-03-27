import axios from "axios";
import { authService } from "../services/authService.js";
import { imageService } from "../services/imageService.js";
import { formatService } from "../services/formatService.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { PublishPayload, PublishResult } from "./types.js";

const GRAPHQL_URL = "https://gql.hashnode.com";

async function hashnodeQuery<T>(
  query: string,
  variables: Record<string, any>,
  token: string
): Promise<T> {
  const response = await axios.post<{ data: T; errors?: any[] }>(
    GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    }
  );

  if (response.data.errors?.length) {
    throw new Error(response.data.errors[0].message);
  }

  return response.data.data;
}

export async function publishToHashnode(
  payload: PublishPayload
): Promise<PublishResult> {
  const creds = authService.getCredentials("hashnode");
  if (!creds?.api_key || !creds?.publication_id) {
    return {
      platform: "hashnode",
      success: false,
      error:
        'Hashnode credentials not configured. Use manage_platforms with action "add" and platform "hashnode". Required fields: api_key, publication_id.',
    };
  }

  try {
    const result = await withRetry(async () => {
      // Process images: Hashnode accepts external URLs directly
      const { urlMap: localMap } = await imageService.processMarkdownImages(
        payload.content_markdown
      );

      // For Hashnode, we keep original URLs since they only accept external URLs
      const imageUrlMap = new Map<string, string>();
      for (const [originalUrl] of localMap.entries()) {
        imageUrlMap.set(originalUrl, originalUrl);
      }

      const formattedMarkdown = formatService.formatForHashnode(
        payload.content_markdown,
        imageUrlMap
      );

      const mutation = `
        mutation PublishPost($input: PublishPostInput!) {
          publishPost(input: $input) {
            post {
              id
              url
              slug
              title
            }
          }
        }
      `;

      const tags = payload.tags.slice(0, 5).map((tag) => ({
        slug: tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        name: tag,
      }));

      const variables: Record<string, any> = {
        input: {
          title: payload.title,
          contentMarkdown: formattedMarkdown,
          publicationId: creds.publication_id,
          tags,
          ...(payload.canonical_url
            ? { originalArticleURL: payload.canonical_url }
            : {}),
          ...(payload.excerpt ? { subtitle: formatService.truncate(payload.excerpt, 250) } : {}),
        },
      };

      if (payload.cover_image_url) {
        variables.input.coverImageOptions = {
          coverImageURL: payload.cover_image_url,
        };
      }

      const data = await hashnodeQuery<{
        publishPost: { post: { id: string; url: string } };
      }>(mutation, variables, creds.api_key);

      return data.publishPost.post;
    });

    logger.info(`Published to Hashnode: ${result.url}`);
    return { platform: "hashnode", success: true, url: result.url };
  } catch (err: any) {
    const error = err.message ?? "Unknown error";
    logger.error(`Hashnode publish failed`, { error });
    return { platform: "hashnode", success: false, error };
  }
}

export async function testHashnodeConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  const creds = authService.getCredentials("hashnode");
  if (!creds?.api_key) {
    return { success: false, message: "No API key configured." };
  }

  const query = `
    query {
      me {
        id
        username
        name
      }
    }
  `;

  try {
    const data = await hashnodeQuery<{ me: { username: string; name: string } }>(
      query,
      {},
      creds.api_key
    );
    return {
      success: true,
      message: `Connected as @${data.me.username} (${data.me.name})`,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function syncHashnodeAnalytics(articleUrl: string): Promise<{
  reactions: number;
  pageViews: number;
  comments: number;
} | null> {
  const creds = authService.getCredentials("hashnode");
  if (!creds?.api_key || !creds?.publication_id) return null;

  try {
    // Extract slug from URL
    const slug = articleUrl.split("/").pop() ?? "";

    const query = `
      query GetPost($publicationId: ObjectId!, $slug: String!) {
        publication(id: $publicationId) {
          post(slug: $slug) {
            id
            reactionCount
            views
            responseCount
          }
        }
      }
    `;

    const data = await hashnodeQuery<{
      publication: {
        post: {
          reactionCount: number;
          views: number;
          responseCount: number;
        } | null;
      };
    }>(query, { publicationId: creds.publication_id, slug }, creds.api_key);

    const post = data.publication.post;
    if (!post) return null;

    return {
      reactions: post.reactionCount ?? 0,
      pageViews: post.views ?? 0,
      comments: post.responseCount ?? 0,
    };
  } catch {
    return null;
  }
}

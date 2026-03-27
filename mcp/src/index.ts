import "dotenv/config";
import axios from "axios";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@notionhq/client";
import { z } from "zod";

import { NotionClient } from "./notion/client.js";
import { NotionParser } from "./notion/parser.js";

import { listDrafts, listDraftsSchema } from "./tools/list_drafts.js";
import { previewPost, previewPostSchema } from "./tools/preview_post.js";
import { publishPost, publishPostSchema } from "./tools/publish_post.js";
import {
  getPublishStatus,
  getPublishStatusSchema,
} from "./tools/get_publish_status.js";
import { schedulePost, schedulePostSchema } from "./tools/schedule_post.js";
import { syncAnalytics, syncAnalyticsSchema } from "./tools/sync_analytics.js";
import {
  managePlatforms,
  managePlatformsSchema,
} from "./tools/manage_platforms.js";

// ── Tool definitions for MCP protocol ────────────────────────────────────────

const TOOLS = [
  {
    name: "list_drafts",
    description:
      "Lists posts from your Notion BlogCast database filtered by status. Use this to see what's ready to publish.",
    inputSchema: zodToJsonSchema(listDraftsSchema),
  },
  {
    name: "preview_post",
    description:
      "Fetches a post from Notion and returns its full content as Markdown for review, without publishing anything.",
    inputSchema: zodToJsonSchema(previewPostSchema),
  },
  {
    name: "publish_post",
    description:
      "Publishes a Notion blog post to one or more platforms (Dev.to, Hashnode, etc.). Handles images, formatting, and logs results back to Notion.",
    inputSchema: zodToJsonSchema(publishPostSchema),
  },
  {
    name: "get_publish_status",
    description:
      "Returns the publish status of a post across all platforms, including URLs, errors, and engagement stats from the Notion Analytics database.",
    inputSchema: zodToJsonSchema(getPublishStatusSchema),
  },
  {
    name: "schedule_post",
    description:
      "Sets a scheduled publish time on a Notion post. The backend will auto-publish at the specified time.",
    inputSchema: zodToJsonSchema(schedulePostSchema),
  },
  {
    name: "sync_analytics",
    description:
      "Pulls the latest stats (views, reactions, comments) from publishing platforms and updates the Notion Analytics database.",
    inputSchema: zodToJsonSchema(syncAnalyticsSchema),
  },
  {
    name: "manage_platforms",
    description:
      "View, add, remove, or test API credentials for publishing platforms stored in the local encrypted auth vault.",
    inputSchema: zodToJsonSchema(managePlatformsSchema),
  },
];

// ── Minimal Zod → JSON Schema converter ──────────────────────────────────────

function zodToJsonSchema(schema: z.ZodTypeAny): object {
  // We use a simple approach: extract from the Zod definition
  // For production, use zod-to-json-schema package
  const shape = (schema as any)._def?.shape?.() ?? {};
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodValue = value as z.ZodTypeAny;
    const def = (zodValue as any)._def;
    const isOptional =
      def?.typeName === "ZodOptional" ||
      def?.typeName === "ZodDefault";

    if (!isOptional) {
      required.push(key);
    }

    properties[key] = zodFieldToJsonSchema(zodValue, key);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function zodFieldToJsonSchema(field: z.ZodTypeAny, key: string): object {
  const def = (field as any)._def;
  const typeName = def?.typeName;

  const description = def?.description;
  const base: Record<string, any> = {};
  if (description) base.description = description;

  if (typeName === "ZodDefault") {
    const inner = zodFieldToJsonSchema(def.innerType, key);
    return { ...inner, default: def.defaultValue(), ...base };
  }

  if (typeName === "ZodOptional") {
    return { ...zodFieldToJsonSchema(def.innerType, key), ...base };
  }

  if (typeName === "ZodString") {
    return { type: "string", ...base };
  }

  if (typeName === "ZodNumber") {
    const schema: Record<string, any> = { type: "number", ...base };
    if (def.checks) {
      for (const check of def.checks) {
        if (check.kind === "min") schema.minimum = check.value;
        if (check.kind === "max") schema.maximum = check.value;
        if (check.kind === "int") schema.type = "integer";
      }
    }
    return schema;
  }

  if (typeName === "ZodBoolean") {
    return { type: "boolean", ...base };
  }

  if (typeName === "ZodEnum") {
    return { type: "string", enum: def.values, ...base };
  }

  if (typeName === "ZodArray") {
    return {
      type: "array",
      items: zodFieldToJsonSchema(def.type, key),
      ...base,
    };
  }

  if (typeName === "ZodRecord") {
    return { type: "object", additionalProperties: { type: "string" }, ...base };
  }

  return { type: "string", ...base };
}

// ── Lazy client resolution ────────────────────────────────────────────────────
// Credentials are resolved on the first tool call, not at startup.
// This prevents a crash when the MCP server starts before the backend.

let _notion: NotionClient | null = null;
let _parser: NotionParser | null = null;

async function getClients(): Promise<{ notion: NotionClient; parser: NotionParser }> {
  if (_notion && _parser) return { notion: _notion, parser: _parser };
  // Reset on failure so a subsequent call after the user configures Settings will retry
  try {

  _notion = await NotionClient.create();

  // Resolve the raw API key for the Notion SDK (used by notion-to-md)
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";
  const apiKey =
    process.env.NOTION_API_KEY ||
    (await axios
      .get<{ notion: { apiKey: string } }>(`${backendUrl}/api/config/status-full`, {
        timeout: 5_000,
      })
      .then((r) => r.data.notion.apiKey)
      .catch(() => ""));

  const rawNotionClient = new Client({ auth: apiKey });
  _parser = new NotionParser(rawNotionClient);

  return { notion: _notion, parser: _parser };
  } catch (err) {
    // Don't cache a failed state — let the next tool call retry
    _notion = null;
    _parser = null;
    throw err;
  }
}

// ── Server setup ──────────────────────────────────────────────────────────────

async function main() {
  const server = new Server(
    {
      name: "blogcast",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools — always works, no backend needed
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls — resolve clients lazily on first use
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      // manage_platforms doesn't need Notion at all
      if (name === "manage_platforms") {
        const input = managePlatformsSchema.parse(args);
        result = await managePlatforms(input);
        return { content: [{ type: "text", text: result }] };
      }

      // All other tools need Notion — resolve lazily
      const { notion, parser } = await getClients();

      switch (name) {
        case "list_drafts": {
          const input = listDraftsSchema.parse(args);
          result = await listDrafts(input, notion);
          break;
        }
        case "preview_post": {
          const input = previewPostSchema.parse(args);
          result = await previewPost(input, notion, parser);
          break;
        }
        case "publish_post": {
          const input = publishPostSchema.parse(args);
          result = await publishPost(input, notion, parser);
          break;
        }
        case "get_publish_status": {
          const input = getPublishStatusSchema.parse(args);
          result = await getPublishStatus(input, notion);
          break;
        }
        case "schedule_post": {
          const input = schedulePostSchema.parse(args);
          result = await schedulePost(input, notion);
          break;
        }
        case "sync_analytics": {
          const input = syncAnalyticsSchema.parse(args);
          result = await syncAnalytics(input, notion);
          break;
        }
        default:
          result = `Unknown tool: ${name}`;
      }

      return {
        content: [{ type: "text", text: result }],
      };
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return {
          content: [
            {
              type: "text",
              text: `Invalid input: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Error in ${name}: ${err.message ?? String(err)}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("BlogCast MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

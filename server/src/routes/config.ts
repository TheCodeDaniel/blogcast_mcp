import { Router } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { configService } from "../services/configService.js";
import { logger } from "../utils/logger.js";

export const configRouter = Router();

// GET /api/config — return saved config (masks secrets)
configRouter.get("/", (_req, res) => {
  const saved = configService.getSaved();

  res.json({
    notion: {
      apiKey: saved.notion.apiKey ? maskSecret(saved.notion.apiKey) : "",
      postsDbId: saved.notion.postsDbId,
      analyticsDbId: saved.notion.analyticsDbId,
      fromEnv: {
        apiKey: !saved.notion.apiKey && !!process.env.NOTION_API_KEY,
        postsDbId: !saved.notion.postsDbId && !!process.env.NOTION_POSTS_DB_ID,
        analyticsDbId:
          !saved.notion.analyticsDbId && !!process.env.NOTION_ANALYTICS_DB_ID,
      },
    },
    scheduler: saved.scheduler,
    server: saved.server,
    anthropic: {
      apiKey: saved.anthropic?.apiKey ? maskSecret(saved.anthropic.apiKey) : "",
      fromEnv: !saved.anthropic?.apiKey && !!process.env.ANTHROPIC_API_KEY,
    },
    configured: configService.isNotionConfigured(),
    anthropicConfigured: configService.isAnthropicConfigured(),
  });
});

// POST /api/config — save config to vault
configRouter.post("/", (req, res) => {
  const { notion, scheduler, server, anthropic } = req.body;

  // Basic validation
  if (notion) {
    if (typeof notion.apiKey !== "undefined" && typeof notion.apiKey !== "string") {
      res.status(400).json({ error: "notion.apiKey must be a string" });
      return;
    }
  }

  try {
    configService.save({ notion, scheduler, server, anthropic });
    res.json({ success: true, message: "Configuration saved." });
  } catch (err: any) {
    logger.error("Failed to save config", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/config/notion — clear Notion credentials
configRouter.delete("/notion", (_req, res) => {
  configService.save({
    notion: { apiKey: "", postsDbId: "", analyticsDbId: "" },
  });
  res.json({ success: true, message: "Notion credentials cleared." });
});

// DELETE /api/config/anthropic — clear Anthropic API key
configRouter.delete("/anthropic", (_req, res) => {
  configService.clearAnthropicConfig();
  res.json({ success: true, message: "Anthropic API key cleared." });
});

// POST /api/config/claude-desktop — auto-configure Claude Desktop MCP entry
configRouter.post("/claude-desktop", (req, res) => {
  const configPath = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Claude",
    "claude_desktop_config.json"
  );

  // Resolve the MCP server dist path
  const mcpDistPath = path.resolve(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "mcp", "dist", "index.js")
  );

  const blogcastEntry = {
    command: "node",
    args: [mcpDistPath],
    env: {
      BACKEND_URL: `http://localhost:${process.env.PORT ?? "3001"}`,
    },
  };

  let existing: any = {};
  let alreadyExisted = false;

  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      existing = JSON.parse(raw);
      alreadyExisted = !!(existing?.mcpServers?.blogcast);
    }
  } catch {
    // Malformed JSON or missing file — start fresh
    existing = {};
  }

  if (!existing.mcpServers) existing.mcpServers = {};
  existing.mcpServers.blogcast = blogcastEntry;

  try {
    // Ensure the directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), "utf-8");
    logger.info(`Claude Desktop config updated at: ${configPath}`);

    res.json({
      success: true,
      path: configPath,
      alreadyExisted,
      message: alreadyExisted
        ? "BlogCast MCP entry updated in Claude Desktop config."
        : "BlogCast MCP entry added to Claude Desktop config.",
    });
  } catch (err: any) {
    logger.error("Failed to write Claude Desktop config", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/config/status — quick health check including config status
configRouter.get("/status", (_req, res) => {
  const config = configService.get();
  res.json({
    notion: configService.isNotionConfigured(),
    anthropic: configService.isAnthropicConfigured(),
    schedulerEnabled: config.scheduler.enabled,
    pollIntervalMinutes: config.scheduler.pollIntervalMinutes,
  });
});

// GET /api/config/status-full — full unmasked config for MCP server (localhost only)
configRouter.get("/status-full", (req, res) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "";
  const isLocal =
    ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

  if (!isLocal) {
    res.status(403).json({ error: "Forbidden: this endpoint is localhost-only." });
    return;
  }

  const config = configService.get();
  res.json({
    notion: {
      apiKey: config.notion.apiKey,
      postsDbId: config.notion.postsDbId,
      analyticsDbId: config.notion.analyticsDbId,
    },
    configured: configService.isNotionConfigured(),
  });
});

// ── helpers ────────────────────────────────────────────────────────────────

function maskSecret(value: string): string {
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}

import { Router } from "express";
import { configService } from "../services/configService.js";
import { logger } from "../utils/logger.js";

export const configRouter = Router();

// GET /api/config — return saved config (masks secrets)
configRouter.get("/", (_req, res) => {
  const saved = configService.getSaved();

  res.json({
    notion: {
      // Mask the key — only reveal if it exists
      apiKey: saved.notion.apiKey ? maskSecret(saved.notion.apiKey) : "",
      postsDbId: saved.notion.postsDbId,
      analyticsDbId: saved.notion.analyticsDbId,
      // Also report if it came from env (so UI can show the right hint)
      fromEnv: {
        apiKey: !saved.notion.apiKey && !!process.env.NOTION_API_KEY,
        postsDbId: !saved.notion.postsDbId && !!process.env.NOTION_POSTS_DB_ID,
        analyticsDbId:
          !saved.notion.analyticsDbId && !!process.env.NOTION_ANALYTICS_DB_ID,
      },
    },
    scheduler: saved.scheduler,
    server: saved.server,
    configured: configService.isNotionConfigured(),
  });
});

// POST /api/config — save config to vault
configRouter.post("/", (req, res) => {
  const { notion, scheduler, server } = req.body;

  // Basic validation
  if (notion) {
    if (typeof notion.apiKey !== "undefined" && typeof notion.apiKey !== "string") {
      res.status(400).json({ error: "notion.apiKey must be a string" });
      return;
    }
  }

  try {
    configService.save({ notion, scheduler, server });
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

// GET /api/config/status — quick health check including config status
configRouter.get("/status", (_req, res) => {
  const config = configService.get();
  res.json({
    notion: configService.isNotionConfigured(),
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

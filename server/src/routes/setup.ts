import { Router } from "express";
import { setupNotionDatabases } from "../services/notionSetupService.js";
import { logger } from "../utils/logger.js";

export const setupRouter = Router();

// POST /api/setup/notion — run DB migration manually (idempotent)
setupRouter.post("/notion", async (_req, res) => {
  try {
    const result = await setupNotionDatabases();
    res.json({
      success: true,
      message: "Notion databases are set up and ready.",
      postsDbId: result.posts,
      analyticsDbId: result.analytics,
    });
  } catch (err: any) {
    logger.error("Notion setup failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

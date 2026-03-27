import { Router } from "express";
import { checkPrePublish, generateExcerptAndTags } from "../services/aiService.js";
import { configService } from "../services/configService.js";
import { logger } from "../utils/logger.js";

export const aiRouter = Router();

// POST /api/ai/precheck
aiRouter.post("/precheck", async (req, res) => {
  if (!configService.isAnthropicConfigured()) {
    res.status(400).json({ error: "Anthropic API key not configured." });
    return;
  }

  const { title, content, tags, excerpt } = req.body;

  if (!title || !content) {
    res.status(400).json({ error: "title and content are required" });
    return;
  }

  try {
    const warnings = await checkPrePublish({
      title,
      content,
      tags: Array.isArray(tags) ? tags : [],
      excerpt: excerpt ?? "",
    });
    res.json({ warnings });
  } catch (err: any) {
    logger.error("Pre-publish check error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/enhance
aiRouter.post("/enhance", async (req, res) => {
  if (!configService.isAnthropicConfigured()) {
    res.status(400).json({ error: "Anthropic API key not configured." });
    return;
  }

  const { title, content } = req.body;

  if (!title || !content) {
    res.status(400).json({ error: "title and content are required" });
    return;
  }

  try {
    const result = await generateExcerptAndTags({ title, content });
    res.json(result);
  } catch (err: any) {
    logger.error("Enhance post error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

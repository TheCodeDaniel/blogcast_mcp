import { Router } from "express";
import { imageService } from "../services/imageService.js";
import { logger } from "../utils/logger.js";

export const imagesRouter = Router();

// POST /api/images/process — download and cache an image
imagesRouter.post("/process", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  try {
    const localPath = await imageService.downloadAndCache(url);
    res.json({ success: true, localPath });
  } catch (err: any) {
    logger.error("Image process failed", { url, error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

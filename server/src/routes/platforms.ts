import { Router } from "express";
import { authService } from "../services/authService.js";
import { testDevtoConnection } from "../publishers/devto.js";
import { testHashnodeConnection } from "../publishers/hashnode.js";
import { logger } from "../utils/logger.js";

export const platformsRouter = Router();

const ALL_PLATFORMS = [
  "devto",
  "hashnode",
  "medium",
  "linkedin",
  "ghost",
  "wordpress",
];

const TESTERS: Record<
  string,
  () => Promise<{ success: boolean; message: string }>
> = {
  devto: testDevtoConnection,
  hashnode: testHashnodeConnection,
};

// GET /api/platforms — list all platforms and their config status
platformsRouter.get("/", (_req, res) => {
  const configured = authService.listConfiguredPlatforms();

  const platforms = ALL_PLATFORMS.map((p) => ({
    platform: p,
    configured: configured.includes(p),
    connected: false, // set to true after a successful test
    v1Supported: ["devto", "hashnode"].includes(p),
  }));

  res.json(platforms);
});

// POST /api/platforms/:name/credentials — save credentials
platformsRouter.post("/:name/credentials", (req, res) => {
  const { name } = req.params;
  const { credentials } = req.body;

  if (!ALL_PLATFORMS.includes(name)) {
    res.status(400).json({ error: `Unknown platform: ${name}` });
    return;
  }

  if (!credentials || typeof credentials !== "object") {
    res.status(400).json({ error: "credentials must be an object" });
    return;
  }

  authService.setCredentials(name, credentials);
  logger.info(`Credentials saved for ${name}`);
  res.json({ success: true, message: `Credentials saved for ${name}` });
});

// DELETE /api/platforms/:name/credentials — remove credentials
platformsRouter.delete("/:name/credentials", (req, res) => {
  const { name } = req.params;

  if (!authService.hasCredentials(name)) {
    res.status(404).json({ error: `No credentials found for ${name}` });
    return;
  }

  authService.removeCredentials(name);
  res.json({ success: true, message: `Credentials removed for ${name}` });
});

// POST /api/platforms/:name/test — test platform connection
platformsRouter.post("/:name/test", async (req, res) => {
  const { name } = req.params;

  if (!ALL_PLATFORMS.includes(name)) {
    res.status(400).json({ error: `Unknown platform: ${name}` });
    return;
  }

  const tester = TESTERS[name];
  if (!tester) {
    res.json({
      success: false,
      message: `Connection testing for ${name} is not yet implemented in v1.0.`,
    });
    return;
  }

  try {
    const result = await tester();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

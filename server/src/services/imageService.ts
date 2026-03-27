import axios from "axios";
import sharp from "sharp";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

interface ImageMetadata {
  originalUrl: string;
  localPath: string;
  hash: string;
  ext: string;
  platformUrls: Record<string, string>;
  cachedAt: string;
}

interface MetadataStore {
  [hash: string]: ImageMetadata;
}

const storagePath = process.env.STORAGE_PATH ?? "./storage";
const imagesDir = path.join(storagePath, "images");
const metadataFile = path.join(imagesDir, "metadata.json");

function ensureImagesDir(): void {
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

function loadMetadata(): MetadataStore {
  ensureImagesDir();
  if (!fs.existsSync(metadataFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(metadataFile, "utf-8"));
  } catch {
    return {};
  }
}

function saveMetadata(store: MetadataStore): void {
  fs.writeFileSync(metadataFile, JSON.stringify(store, null, 2));
}

function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function getExtFromUrl(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i);
  return match ? match[1].toLowerCase() : "jpg";
}

export const imageService = {
  /**
   * Downloads an image from a URL, caches it locally, and returns the local path.
   * Returns the cached path if already downloaded.
   */
  async downloadAndCache(imageUrl: string): Promise<string> {
    ensureImagesDir();
    const store = loadMetadata();
    const hash = hashUrl(imageUrl);

    // Return cached version if exists and file is still there
    if (store[hash] && fs.existsSync(store[hash].localPath)) {
      logger.debug(`Image cache hit: ${imageUrl}`);
      return store[hash].localPath;
    }

    const ext = getExtFromUrl(imageUrl);
    const localPath = path.join(imagesDir, `${hash}.${ext}`);

    logger.info(`Downloading image: ${imageUrl}`);

    await withRetry(async () => {
      const response = await axios.get<Buffer>(imageUrl, {
        responseType: "arraybuffer",
        timeout: 30_000,
        headers: { "User-Agent": "BlogCast/1.0" },
      });

      const buffer = Buffer.from(response.data);

      // Optimize with sharp (convert to WebP for smaller size, unless SVG)
      if (ext !== "svg") {
        await sharp(buffer)
          .resize({ width: 2000, withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toFile(localPath.replace(`.${ext}`, ".jpg"));

        // Update path to .jpg
        const jpgPath = localPath.replace(`.${ext}`, ".jpg");
        store[hash] = {
          originalUrl: imageUrl,
          localPath: jpgPath,
          hash,
          ext: "jpg",
          platformUrls: {},
          cachedAt: new Date().toISOString(),
        };
      } else {
        fs.writeFileSync(localPath, buffer);
        store[hash] = {
          originalUrl: imageUrl,
          localPath,
          hash,
          ext,
          platformUrls: {},
          cachedAt: new Date().toISOString(),
        };
      }

      saveMetadata(store);
    });

    return store[hash].localPath;
  },

  /**
   * Gets a previously uploaded URL for a platform (avoids re-uploading).
   */
  getPlatformUrl(imageUrl: string, platform: string): string | null {
    const store = loadMetadata();
    const hash = hashUrl(imageUrl);
    return store[hash]?.platformUrls[platform] ?? null;
  },

  /**
   * Saves a platform-specific URL after uploading an image.
   */
  savePlatformUrl(imageUrl: string, platform: string, platformUrl: string): void {
    const store = loadMetadata();
    const hash = hashUrl(imageUrl);
    if (store[hash]) {
      store[hash].platformUrls[platform] = platformUrl;
      saveMetadata(store);
    }
  },

  /**
   * Returns local path for a cached image, or null if not cached.
   */
  getCachedPath(imageUrl: string): string | null {
    const store = loadMetadata();
    const hash = hashUrl(imageUrl);
    const entry = store[hash];
    if (entry && fs.existsSync(entry.localPath)) {
      return entry.localPath;
    }
    return null;
  },

  /**
   * Downloads all images in markdown and replaces URLs with local paths.
   * Returns updated markdown and a map of original URL → local path.
   */
  async processMarkdownImages(
    markdown: string
  ): Promise<{ markdown: string; urlMap: Map<string, string> }> {
    const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    const urlMap = new Map<string, string>();
    const matches: Array<{ full: string; alt: string; url: string }> = [];

    let match: RegExpExecArray | null;
    while ((match = imageRegex.exec(markdown)) !== null) {
      matches.push({ full: match[0], alt: match[1], url: match[2] });
    }

    // Download all in parallel
    await Promise.allSettled(
      matches.map(async ({ url }) => {
        if (urlMap.has(url)) return;
        try {
          const localPath = await imageService.downloadAndCache(url);
          urlMap.set(url, localPath);
        } catch (err: any) {
          logger.warn(`Failed to download image: ${url}`, {
            error: err.message,
          });
          // Keep original URL on failure
          urlMap.set(url, url);
        }
      })
    );

    return { markdown, urlMap };
  },
};

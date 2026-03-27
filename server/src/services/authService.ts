import Conf from "conf";
import { logger } from "../utils/logger.js";

interface PlatformCredentials {
  [key: string]: string;
}

interface AuthStore {
  platforms: Record<string, PlatformCredentials>;
}

// Conf provides encrypted-at-rest storage in the OS config directory
const store = new Conf<AuthStore>({
  projectName: "blogcast",
  defaults: { platforms: {} },
  encryptionKey: process.env.BLOGCAST_ENCRYPTION_KEY ?? "blogcast-local-dev-key",
});

export const authService = {
  getCredentials(platform: string): PlatformCredentials | null {
    const platforms = store.get("platforms") as Record<string, PlatformCredentials>;
    return platforms[platform] ?? null;
  },

  setCredentials(platform: string, credentials: PlatformCredentials): void {
    const platforms = store.get("platforms") as Record<string, PlatformCredentials>;
    platforms[platform] = credentials;
    store.set("platforms", platforms);
    logger.info(`Credentials saved for platform: ${platform}`);
  },

  removeCredentials(platform: string): void {
    const platforms = store.get("platforms") as Record<string, PlatformCredentials>;
    delete platforms[platform];
    store.set("platforms", platforms);
    logger.info(`Credentials removed for platform: ${platform}`);
  },

  listConfiguredPlatforms(): string[] {
    const platforms = store.get("platforms") as Record<string, PlatformCredentials>;
    return Object.keys(platforms).filter(
      (p) => Object.keys(platforms[p]).length > 0
    );
  },

  hasCredentials(platform: string): boolean {
    const creds = this.getCredentials(platform);
    return creds !== null && Object.keys(creds).length > 0;
  },
};

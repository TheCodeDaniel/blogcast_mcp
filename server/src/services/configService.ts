import Conf from "conf";
import { logger } from "../utils/logger.js";

export interface AppConfig {
  notion: {
    apiKey: string;
    postsDbId: string;
    analyticsDbId: string;
  };
  scheduler: {
    enabled: boolean;
    pollIntervalMinutes: number;
  };
  server: {
    storagePathOverride: string;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  notion: {
    apiKey: "",
    postsDbId: "",
    analyticsDbId: "",
  },
  scheduler: {
    enabled: true,
    pollIntervalMinutes: 5,
  },
  server: {
    storagePathOverride: "",
  },
};

const store = new Conf<{ appConfig: AppConfig }>({
  projectName: "blogcast",
  encryptionKey: process.env.BLOGCAST_ENCRYPTION_KEY ?? "blogcast-local-dev-key",
  defaults: { appConfig: DEFAULT_CONFIG },
});

export const configService = {
  /**
   * Returns the current app config. Values from the vault take priority
   * over environment variables, which remain as a fallback for CI/Docker.
   */
  get(): AppConfig {
    const saved = store.get("appConfig") as AppConfig;

    return {
      notion: {
        apiKey:
          saved.notion.apiKey ||
          process.env.NOTION_API_KEY ||
          "",
        postsDbId:
          saved.notion.postsDbId ||
          process.env.NOTION_POSTS_DB_ID ||
          "",
        analyticsDbId:
          saved.notion.analyticsDbId ||
          process.env.NOTION_ANALYTICS_DB_ID ||
          "",
      },
      scheduler: {
        enabled:
          saved.scheduler.enabled ??
          process.env.SCHEDULER_ENABLED !== "false",
        pollIntervalMinutes:
          saved.scheduler.pollIntervalMinutes ||
          parseInt(process.env.SCHEDULER_POLL_INTERVAL_MINUTES ?? "5", 10),
      },
      server: {
        storagePathOverride:
          saved.server.storagePathOverride ||
          process.env.STORAGE_PATH ||
          "./storage",
      },
    };
  },

  /**
   * Returns only what's stored in the vault (no env var fallback).
   * Used by the Settings UI to show what the user has explicitly saved.
   */
  getSaved(): AppConfig {
    return store.get("appConfig") as AppConfig;
  },

  save(config: Partial<AppConfig>): void {
    const current = store.get("appConfig") as AppConfig;
    const merged: AppConfig = {
      notion: { ...current.notion, ...config.notion },
      scheduler: { ...current.scheduler, ...config.scheduler },
      server: { ...current.server, ...config.server },
    };
    store.set("appConfig", merged);
    logger.info("App config saved to local vault");
  },

  /**
   * Convenience: get the Notion API key (vault → env).
   */
  getNotionApiKey(): string {
    return this.get().notion.apiKey;
  },

  getNotionPostsDbId(): string {
    return this.get().notion.postsDbId;
  },

  getNotionAnalyticsDbId(): string {
    return this.get().notion.analyticsDbId;
  },

  /**
   * Returns true if Notion is fully configured.
   */
  isNotionConfigured(): boolean {
    const { apiKey, postsDbId, analyticsDbId } = this.get().notion;
    return !!(apiKey && postsDbId && analyticsDbId);
  },
};

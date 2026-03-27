import { z } from "zod";
import axios from "axios";

export const managePlatformsSchema = z.object({
  action: z
    .enum(["list", "add", "remove", "test"])
    .describe("Action to perform on platform credentials."),
  platform: z
    .enum(["devto", "hashnode", "medium", "linkedin", "ghost", "wordpress"])
    .optional()
    .describe("Target platform (required for add, remove, test actions)."),
  credentials: z
    .record(z.string())
    .optional()
    .describe(
      "Credential fields to store (required for 'add'). Fields vary per platform — see documentation."
    ),
});

export type ManagePlatformsInput = z.infer<typeof managePlatformsSchema>;

const PLATFORM_CREDENTIAL_FIELDS: Record<string, Record<string, string>> = {
  devto: {
    api_key: "Your Dev.to API key (from https://dev.to/settings/extensions)",
  },
  hashnode: {
    api_key: "Your Hashnode Personal Access Token",
    publication_id: "Your Hashnode Publication ID (from your blog settings)",
  },
  medium: {
    integration_token:
      "Your Medium Integration Token (from https://medium.com/me/settings)",
  },
  linkedin: {
    client_id: "LinkedIn App Client ID",
    client_secret: "LinkedIn App Client Secret",
    access_token: "OAuth 2.0 Access Token (after completing auth flow)",
  },
  ghost: {
    url: "Your Ghost instance URL (e.g. https://myblog.ghost.io)",
    admin_api_key: "Ghost Admin API Key (from Settings > Integrations)",
  },
  wordpress: {
    url: "Your WordPress site URL",
    username: "WordPress username",
    app_password: "Application Password (from WP Users > Security)",
  },
};

export async function managePlatforms(
  input: ManagePlatformsInput
): Promise<string> {
  const { action, platform, credentials } = input;
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";

  if (action !== "list" && !platform) {
    return `The '${action}' action requires a platform to be specified.`;
  }

  try {
    if (action === "list") {
      const response = await axios.get(`${backendUrl}/api/platforms`);
      const platforms = response.data as Array<{
        platform: string;
        configured: boolean;
        connected: boolean;
      }>;

      if (platforms.length === 0) {
        return "No platforms configured yet. Use the 'add' action to add credentials.";
      }

      const lines = [
        "**Configured platforms:**",
        "",
        ...platforms.map((p) => {
          const status = p.configured
            ? p.connected
              ? "✅ Connected"
              : "⚠️  Configured but not verified"
            : "❌ Not configured";
          return `${status} — **${p.platform}**`;
        }),
      ];

      return lines.join("\n");
    }

    if (action === "add") {
      if (!credentials || Object.keys(credentials).length === 0) {
        const fields = PLATFORM_CREDENTIAL_FIELDS[platform!] ?? {};
        const fieldDocs = Object.entries(fields)
          .map(([k, v]) => `  - \`${k}\`: ${v}`)
          .join("\n");

        return [
          `To add ${platform} credentials, provide the following fields:`,
          ``,
          fieldDocs,
          ``,
          `Example: add credentials for ${platform} with the required fields above.`,
        ].join("\n");
      }

      await axios.post(`${backendUrl}/api/platforms/${platform}/credentials`, {
        credentials,
      });

      return `✅ Credentials saved for **${platform}**. Run test to verify the connection.`;
    }

    if (action === "remove") {
      await axios.delete(`${backendUrl}/api/platforms/${platform}/credentials`);
      return `✅ Credentials removed for **${platform}**.`;
    }

    if (action === "test") {
      const response = await axios.post(
        `${backendUrl}/api/platforms/${platform}/test`
      );
      const { success, message } = response.data;

      return success
        ? `✅ **${platform}** — Connection successful!\n${message ?? ""}`
        : `❌ **${platform}** — Connection failed.\n${message ?? "Unknown error"}`;
    }

    return `Unknown action: ${action}`;
  } catch (err: any) {
    if (err.code === "ECONNREFUSED") {
      return `Cannot reach BlogCast backend at ${backendUrl}.\nMake sure the server is running: \`npm run dev:server\``;
    }
    const msg = err.response?.data?.error ?? err.message ?? "Unknown error";
    return `Error performing '${action}' on ${platform ?? "platforms"}: ${msg}`;
  }
}

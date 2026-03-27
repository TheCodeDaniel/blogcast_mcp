import { useEffect, useState } from "react";
import { X, ExternalLink, AlertCircle } from "lucide-react";
import {
  getPlatforms,
  savePlatformCredentials,
  removePlatformCredentials,
  testPlatformConnection,
} from "../lib/api";
import { PlatformStatus } from "../components/PlatformStatus";
import type { PlatformInfo } from "../lib/types";

// Credential field definitions — including where to get each key
const PLATFORM_CONFIG: Record<
  string,
  {
    fields: Array<{ key: string; label: string; secret?: boolean; placeholder?: string }>;
    docs: { label: string; url: string }[];
    note?: string;
  }
> = {
  devto: {
    fields: [
      { key: "api_key", label: "API Key", secret: true, placeholder: "e.g. abcdef1234567890..." },
    ],
    docs: [
      { label: "Get your Dev.to API key", url: "https://dev.to/settings/extensions" },
    ],
  },
  hashnode: {
    fields: [
      { key: "api_key", label: "Personal Access Token", secret: true, placeholder: "e.g. xxxxxxxx-xxxx-xxxx..." },
      { key: "publication_id", label: "Publication ID", placeholder: "e.g. 64a1b2c3d4e5f6a7b8c9d0e1" },
    ],
    docs: [
      { label: "Get your Hashnode token", url: "https://hashnode.com/settings/developer" },
      { label: "Find your Publication ID", url: "https://hashnode.com/settings/developer" },
    ],
    note: "Your Publication ID is shown on the Developer Settings page next to your blog URL.",
  },
  medium: {
    fields: [
      { key: "integration_token", label: "Integration Token", secret: true, placeholder: "e.g. 2f8a3b..." },
    ],
    docs: [
      { label: "Get your Medium Integration Token", url: "https://medium.com/me/settings/security" },
    ],
    note: "⚠️ Medium's API only supports publishing as a Draft. You'll need to manually publish from your Medium dashboard after BlogCast creates the draft.",
  },
  linkedin: {
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "From LinkedIn Developer Portal" },
      { key: "client_secret", label: "Client Secret", secret: true },
      { key: "access_token", label: "Access Token", secret: true, placeholder: "After OAuth flow" },
    ],
    docs: [
      { label: "LinkedIn Developer Portal", url: "https://www.linkedin.com/developers/apps" },
      { label: "LinkedIn OAuth docs", url: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow" },
    ],
    note: "LinkedIn requires completing an OAuth 2.0 flow to get an access token. Create an app in the Developer Portal first.",
  },
  ghost: {
    fields: [
      { key: "url", label: "Ghost URL", placeholder: "https://myblog.ghost.io" },
      { key: "admin_api_key", label: "Admin API Key", secret: true, placeholder: "From Ghost Admin > Integrations" },
    ],
    docs: [
      { label: "Ghost Admin API docs", url: "https://ghost.org/docs/admin-api/" },
    ],
    note: "Go to Ghost Admin → Settings → Integrations → Add custom integration to get your Admin API key.",
  },
  wordpress: {
    fields: [
      { key: "url", label: "WordPress URL", placeholder: "https://myblog.com" },
      { key: "username", label: "Username" },
      { key: "app_password", label: "Application Password", secret: true, placeholder: "xxxx xxxx xxxx xxxx xxxx xxxx" },
    ],
    docs: [
      { label: "WordPress Application Passwords", url: "https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/" },
    ],
    note: "Application Passwords are in WP Admin → Users → Your Profile → scroll to Application Passwords.",
  },
};

interface ConfigModalProps {
  platform: string;
  onClose: () => void;
  onSave: (credentials: Record<string, string>) => Promise<void>;
}

function ConfigModal({ platform, onClose, onSave }: ConfigModalProps) {
  const cfg = PLATFORM_CONFIG[platform];
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFields, setShowFields] = useState<Record<string, boolean>>({});

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  };

  const platformLabel =
    platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-gray-900">
            Configure {platformLabel}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Where to get keys */}
          {cfg?.docs && cfg.docs.length > 0 && (
            <div className="bg-brand-50 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
                Where to get your credentials
              </p>
              {cfg.docs.map((doc) => (
                <a
                  key={doc.url}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 hover:underline"
                >
                  <ExternalLink size={12} />
                  {doc.label}
                </a>
              ))}
            </div>
          )}

          {/* Platform-specific note */}
          {cfg?.note && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{cfg.note}</p>
            </div>
          )}

          {/* Credential fields */}
          {(cfg?.fields ?? []).map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <div className="relative">
                <input
                  type={field.secret && !showFields[field.key] ? "password" : "text"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500 pr-16"
                  value={values[field.key] ?? ""}
                  placeholder={field.placeholder ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
                {field.secret && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowFields((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {showFields[field.key] ? "Hide" : "Show"}
                  </button>
                )}
              </div>
            </div>
          ))}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save credentials"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Platforms() {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      setPlatforms(await getPlatforms());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (platform: string, credentials: Record<string, string>) => {
    await savePlatformCredentials(platform, credentials);
    await load();
  };

  const handleTest = async (platform: string) => {
    setTestResults((prev) => ({ ...prev, [platform]: "Testing..." }));
    try {
      const result = await testPlatformConnection(platform);
      setTestResults((prev) => ({
        ...prev,
        [platform]: result.success
          ? `✅ ${result.message}`
          : `❌ ${result.message}`,
      }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [platform]: "❌ Connection test failed",
      }));
    }
  };

  const handleRemove = async (platform: string) => {
    if (!confirm(`Remove credentials for ${platform}?`)) return;
    await removePlatformCredentials(platform);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading...
      </div>
    );
  }

  const v1Platforms = platforms.filter((p) => p.v1Supported);
  const comingSoon = platforms.filter((p) => !p.v1Supported);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platforms</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage API credentials for your publishing platforms. Keys are stored
          encrypted on your local machine.
        </p>
      </div>

      {/* Supported platforms */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Available now
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {v1Platforms.map((platform) => (
            <div key={platform.platform}>
              <PlatformStatus
                platform={platform}
                onTest={() => handleTest(platform.platform)}
                onConfigure={() => setConfiguring(platform.platform)}
              />
              {testResults[platform.platform] && (
                <p className="text-xs text-gray-500 mt-1.5 px-1">
                  {testResults[platform.platform]}
                </p>
              )}
              {platform.configured && (
                <button
                  onClick={() => handleRemove(platform.platform)}
                  className="mt-1 text-xs text-red-400 hover:text-red-600 px-1"
                >
                  Remove credentials
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Coming soon */}
      {comingSoon.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Coming soon
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {comingSoon.map((platform) => (
              <PlatformStatus key={platform.platform} platform={platform} />
            ))}
          </div>
        </div>
      )}

      {configuring && (
        <ConfigModal
          platform={configuring}
          onClose={() => setConfiguring(null)}
          onSave={(creds) => handleSave(configuring, creds)}
        />
      )}
    </div>
  );
}

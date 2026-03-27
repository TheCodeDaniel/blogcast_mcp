import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getPlatforms,
  savePlatformCredentials,
  removePlatformCredentials,
  testPlatformConnection,
} from "../lib/api";
import { PlatformStatus } from "../components/PlatformStatus";
import type { PlatformInfo } from "../lib/types";

const CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string; secret?: boolean }>> = {
  devto: [
    { key: "api_key", label: "API Key", secret: true },
  ],
  hashnode: [
    { key: "api_key", label: "Personal Access Token", secret: true },
    { key: "publication_id", label: "Publication ID" },
  ],
  medium: [
    { key: "integration_token", label: "Integration Token", secret: true },
  ],
  linkedin: [
    { key: "client_id", label: "Client ID" },
    { key: "client_secret", label: "Client Secret", secret: true },
    { key: "access_token", label: "Access Token", secret: true },
  ],
  ghost: [
    { key: "url", label: "Ghost URL (e.g. https://myblog.ghost.io)" },
    { key: "admin_api_key", label: "Admin API Key", secret: true },
  ],
  wordpress: [
    { key: "url", label: "WordPress URL" },
    { key: "username", label: "Username" },
    { key: "app_password", label: "Application Password", secret: true },
  ],
};

interface ConfigModalProps {
  platform: string;
  onClose: () => void;
  onSave: (credentials: Record<string, string>) => Promise<void>;
}

function ConfigModal({ platform, onClose, onSave }: ConfigModalProps) {
  const fields = CREDENTIAL_FIELDS[platform] ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 capitalize">
            Configure {platform}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <input
                type={field.secret ? "password" : "text"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={field.secret ? "••••••••" : ""}
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
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
        [platform]: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platforms</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage API credentials for your publishing platforms.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {platforms.map((platform) => (
          <div key={platform.platform}>
            <PlatformStatus
              platform={platform}
              onTest={() => handleTest(platform.platform)}
              onConfigure={() => setConfiguring(platform.platform)}
            />
            {testResults[platform.platform] && (
              <p className="text-xs text-gray-500 mt-1 px-1">
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

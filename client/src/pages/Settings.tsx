import { useEffect, useState } from "react";
import {
  Save,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { getConfig, saveConfig, clearNotionConfig } from "../lib/api";
import type { AppConfigResponse } from "../lib/api";

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  hint?: string;
  fromEnv?: boolean;
  disabled?: boolean;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret,
  hint,
  fromEnv,
  disabled,
}: FieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {fromEnv && (
          <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
            Set via .env
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type={secret && !visible ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fromEnv ? "(already set in .env)" : placeholder}
          disabled={disabled || fromEnv}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500
                     disabled:bg-gray-50 disabled:text-gray-400 pr-10"
        />
        {secret && !fromEnv && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Settings() {
  const [config, setConfig] = useState<AppConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Form state
  const [notionApiKey, setNotionApiKey] = useState("");
  const [postsDbId, setPostsDbId] = useState("");
  const [analyticsDbId, setAnalyticsDbId] = useState("");
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [pollInterval, setPollInterval] = useState(5);

  useEffect(() => {
    getConfig()
      .then((cfg) => {
        setConfig(cfg);
        // Pre-fill non-secret fields from saved config
        setPostsDbId(cfg.notion.postsDbId);
        setAnalyticsDbId(cfg.notion.analyticsDbId);
        setSchedulerEnabled(cfg.scheduler.enabled);
        setPollInterval(cfg.scheduler.pollIntervalMinutes);
        // Don't pre-fill the API key (masked) — user must re-enter to change
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      await saveConfig({
        notion: {
          // Only send the API key if the user typed a new one
          ...(notionApiKey ? { apiKey: notionApiKey } : {}),
          postsDbId,
          analyticsDbId,
        },
        scheduler: {
          enabled: schedulerEnabled,
          pollIntervalMinutes: pollInterval,
        },
      });
      setStatus("saved");
      // Reload config to reflect masked state
      const updated = await getConfig();
      setConfig(updated);
      setNotionApiKey(""); // clear after save
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.response?.data?.error ?? err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleClearNotion = async () => {
    if (!confirm("Clear all saved Notion credentials?")) return;
    await clearNotionConfig();
    const updated = await getConfig();
    setConfig(updated);
    setNotionApiKey("");
    setPostsDbId("");
    setAnalyticsDbId("");
  };

  const isConfigured = config?.configured ?? false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          All credentials are stored encrypted on your local machine — nothing
          is sent to any server.
        </p>
      </div>

      {/* Status banner */}
      {isConfigured ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
          <CheckCircle size={16} className="shrink-0" />
          Notion is connected. BlogCast is ready to use.
        </div>
      ) : (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Notion not configured</p>
            <p className="mt-0.5">
              Fill in your Notion API key and database IDs below to get started.
            </p>
          </div>
        </div>
      )}

      {/* Notion config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Notion Integration</h2>
          <a
            href="https://www.notion.so/my-integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 hover:underline flex items-center gap-1"
          >
            <ExternalLink size={11} />
            Create integration
          </a>
        </div>

        <Field
          label="API Key"
          value={notionApiKey}
          onChange={setNotionApiKey}
          placeholder={
            config?.notion.apiKey
              ? `Currently: ${config.notion.apiKey} — type to replace`
              : "secret_xxxxxxxxxxxxxxxxxxxx"
          }
          secret
          fromEnv={config?.notion.fromEnv.apiKey}
          hint="From notion.so/my-integrations → your integration → show token"
        />

        <Field
          label="Posts Database ID"
          value={postsDbId}
          onChange={setPostsDbId}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          fromEnv={config?.notion.fromEnv.postsDbId}
          hint="From the URL of your BlogCast Posts database page"
        />

        <Field
          label="Analytics Database ID"
          value={analyticsDbId}
          onChange={setAnalyticsDbId}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          fromEnv={config?.notion.fromEnv.analyticsDbId}
          hint="From the URL of your BlogCast Analytics database page"
        />

        <div className="flex items-center justify-between pt-1">
          <a
            href="https://www.notion.so/help/create-integrations-with-the-notion-api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <ExternalLink size={11} />
            How to find database IDs
          </a>
          {isConfigured && (
            <button
              onClick={handleClearNotion}
              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
            >
              <Trash2 size={11} />
              Clear Notion credentials
            </button>
          )}
        </div>
      </div>

      {/* Scheduler config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Scheduler</h2>
        <p className="text-sm text-gray-500">
          Automatically publishes posts when their Scheduled At time arrives.
          Requires the backend to be running.
        </p>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Enable scheduler</span>
          <button
            onClick={() => setSchedulerEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              schedulerEnabled ? "bg-brand-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                schedulerEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {schedulerEnabled && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Check interval (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={pollInterval}
              onChange={(e) => setPollInterval(parseInt(e.target.value) || 5)}
              className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}
      </div>

      {/* Claude Desktop snippet */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Claude Desktop MCP Config</h2>
        <p className="text-sm text-gray-500">
          Add this to your{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">
            claude_desktop_config.json
          </code>{" "}
          after building the MCP server with{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">
            npm run build:mcp
          </code>
          :
        </p>

        <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto leading-relaxed">
{`{
  "mcpServers": {
    "blogcast": {
      "command": "node",
      "args": ["/path/to/blogcast/mcp/dist/index.js"],
      "env": {
        "BACKEND_URL": "http://localhost:3001"
      }
    }
  }
}`}
        </pre>
        <p className="text-xs text-gray-400">
          The MCP server fetches Notion credentials from the backend at runtime
          — no need to put them in this config.
        </p>
      </div>

      {/* Save button + feedback */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Save size={15} />
          {saving ? "Saving..." : "Save settings"}
        </button>

        {status === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle size={14} />
            Saved successfully
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle size={14} />
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Save, ExternalLink } from "lucide-react";

export function Settings() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure your BlogCast installation.
        </p>
      </div>

      {/* Notion setup */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Notion Integration</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notion API Key
            </label>
            <input
              type="password"
              placeholder="secret_xxxxxxxxxxxxxxxxxxxx"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              readOnly
              value="Set in .env file"
            />
            <p className="text-xs text-gray-400 mt-1">
              Edit the <code className="bg-gray-100 px-1 rounded">.env</code>{" "}
              file in your project root to update this.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Posts Database ID
            </label>
            <input
              type="text"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              readOnly
              value="Set in .env file"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Analytics Database ID
            </label>
            <input
              type="text"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              readOnly
              value="Set in .env file"
            />
          </div>
        </div>

        <a
          href="https://www.notion.so/my-integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
        >
          <ExternalLink size={13} />
          Manage Notion integrations
        </a>
      </div>

      {/* Scheduler settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Scheduler</h2>
        <p className="text-sm text-gray-500">
          The scheduler runs inside the backend server and automatically
          publishes posts when their scheduled time arrives.
        </p>

        <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 space-y-1">
          <p>SCHEDULER_ENABLED=true</p>
          <p>SCHEDULER_POLL_INTERVAL_MINUTES=5</p>
        </div>

        <p className="text-xs text-gray-400">
          Edit these values in your{" "}
          <code className="bg-gray-100 px-1 rounded">.env</code> file and
          restart the server.
        </p>
      </div>

      {/* Claude Desktop config */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Claude Desktop MCP Config</h2>
        <p className="text-sm text-gray-500">
          Add this to your{" "}
          <code className="bg-gray-100 px-1 rounded">claude_desktop_config.json</code>:
        </p>

        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "blogcast": {
      "command": "node",
      "args": ["/path/to/blogcast/mcp/dist/index.js"],
      "env": {
        "NOTION_API_KEY": "your_key_here",
        "NOTION_POSTS_DB_ID": "your_db_id",
        "NOTION_ANALYTICS_DB_ID": "your_analytics_db_id",
        "BACKEND_URL": "http://localhost:3001"
      }
    }
  }
}`}
        </pre>

        <a
          href="https://modelcontextprotocol.io/quickstart/user"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
        >
          <ExternalLink size={13} />
          MCP setup guide
        </a>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        <Save size={15} />
        {saved ? "Saved!" : "Save settings"}
      </button>
    </div>
  );
}

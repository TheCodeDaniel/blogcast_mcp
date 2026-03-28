# BlogCast MCP

> One post. Every platform. Powered by Notion + Claude.

BlogCast MCP is an open-source Model Context Protocol server that turns Notion into a headless CMS and publishing hub. Write once in the dashboard or in Notion, then use Claude (or the dashboard) to publish simultaneously to Dev.to, Hashnode, Medium, and more.

---

## What's Inside

| Package | Description | Port |
|---|---|---|
| `mcp/` | MCP server — Claude integration layer | stdio |
| `server/` | Express.js backend — publishing, images, scheduling, AI | 3001 |
| `client/` | React dashboard — write posts, publish, manage platforms | 5173 |

---

## Quickstart

### Prerequisites

- Node.js 20+, npm 10+
- A Notion account with API access
- Claude Desktop (for MCP tools) — optional if you only use the dashboard

### 1. Clone & install

```bash
git clone https://github.com/thecodedaniel/blogcast-mcp.git
cd blogcast
npm install
```

### 2. Run everything

```bash
npm run dev          # starts server (3001) + client (5173)
```

Or run individually:

```bash
npm run dev:server   # Express backend only
npm run dev:client   # React dashboard only
npm run dev:mcp      # MCP server only (for testing)
```

### 3. Open the dashboard

Navigate to `http://localhost:5173` — the Settings page will guide you through:

1. **Notion integration** — API key + database IDs
2. **Platform credentials** — Dev.to, Hashnode, Medium API keys
3. **AI features** — Anthropic API key (optional, unlocks smart pre-publish checks)
4. **Claude Desktop** — one-click auto-configure (no manual JSON editing)

> **First run:** Once you add your Notion credentials, BlogCast automatically sets up all required database columns (idempotent — safe to re-run at any time).

### 4. Set up Notion

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration
2. Create two databases in Notion: **BlogCast Posts** and **BlogCast Analytics**
3. Share both databases with your integration (open each DB → ⋯ → Connections → add your integration)
4. Copy the database IDs from the page URLs (the 32-char string after the last `/`)
5. Add both IDs in `localhost:5173/settings`

BlogCast will automatically add all required columns to both databases on first run.

### 5. Build the MCP server (for Claude Desktop)

```bash
npm run build:mcp
```

Then in Settings, click **"Connect Claude Desktop"** — BlogCast will auto-configure `claude_desktop_config.json` for you.

Or add manually to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "blogcast": {
      "command": "node",
      "args": ["/absolute/path/to/blogcast/mcp/dist/index.js"],
      "env": {
        "BACKEND_URL": "http://localhost:3001"
      }
    }
  }
}
```

---

## Writing Posts

### Option A — In the Dashboard (recommended)

1. Click **Write** in the sidebar
2. Type your title and write your post using the rich text editor
   - Full toolbar: bold, italic, headings, inline code, **code blocks with syntax highlighting** (TypeScript, Python, Dart, Go, Rust, and 20+ more languages)
   - Live **Preview** mode toggle
3. Add tags, excerpt, and choose target platforms in the right sidebar
4. Click **Save Draft** (saves to Notion) or **Save & Publish** (saves + publishes immediately)

### Option B — In Notion directly

1. Open your **BlogCast Posts** database in Notion
2. Click **+ New** and write your post content inside the page
3. Fill in the properties: Title, Tags, Publish To, Excerpt
4. Set Status to *Draft* — it appears in the dashboard automatically

---

## Publishing

### Via the Dashboard

1. **Write → Save & Publish** — write and publish in one step
2. **Posts** → click any post → redirects to **Publish** page → choose platforms → click Publish

### Via Claude (MCP)

```
"Show me my draft posts"
"Preview my latest Notion draft"
"Publish my post about TypeScript to Dev.to and Hashnode"
"What's the status of my last post?"
"Schedule my React post for tomorrow at 9am UTC on all platforms"
"Add my Hashnode API key"
"Sync analytics for my last 5 posts"
```

---

## MCP Tools

| Tool | Description |
|---|---|
| `list_drafts` | List posts by status (Draft, Review, Scheduled, all) |
| `preview_post` | Fetch post content as Markdown without publishing |
| `publish_post` | Publish to Dev.to + Hashnode + Medium (with image handling) |
| `get_publish_status` | Check publish status + analytics per platform |
| `schedule_post` | Set a scheduled publish time on a post |
| `sync_analytics` | Pull latest views/reactions/comments into Notion |
| `manage_platforms` | Add/remove/test platform API credentials |

---

## AI Features

When an Anthropic API key is configured (`Settings → AI Features`):

| Feature | Where |
|---|---|
| **Pre-publish check** | Publish page — AI reviews title, tags, content quality before publishing |
| **Excerpt & tag generation** | Write page (Generate button) + Publish page |
| **Per-platform content adaptation** | Auto-applied on publish — Medium gets optimized HTML, Dev.to/Hashnode get Markdown tweaks |

AI features are fully optional and degrade gracefully — publishing works normally without an Anthropic key.

---

## Architecture

```
Notion Workspace (CMS + Analytics DB)
        │ Notion API
        ▼
BlogCast MCP Server (stdio, Claude integration)
        │ HTTP
        ▼
Express Backend (localhost:3001)
  ├── Publishers: Dev.to, Hashnode, Medium (draft)
  ├── AI service (Anthropic SDK — pre-publish checks, content adaptation)
  ├── Image service (download → cache → re-upload)
  ├── Format service (Markdown ↔ HTML)
  ├── Auth vault (encrypted local credentials)
  ├── Setup service (Notion DB auto-migration on startup)
  └── Scheduler (auto-publish at scheduled time)
        │
        ▼
Local Storage (./storage/)
  ├── images/   — cached images with deduplication
  ├── queue/    — pending publish jobs
  └── logs/     — winston logs

React Dashboard (localhost:5173)
  ├── Write     — TipTap rich text editor with syntax-highlighted code blocks
  ├── Posts     — list, search, filter all posts from Notion
  ├── Publish   — select post + platforms + AI pre-publish check
  ├── Platforms — add/remove/test API keys
  └── Settings  — Notion config, AI config, Claude Desktop auto-connect
```

---

## Image Handling

Notion CDN URLs expire after ~1 hour. BlogCast handles this transparently:

1. Images are downloaded from Notion and cached locally in `storage/images/`
2. Each image is hashed by URL (SHA-256) for deduplication
3. On publish, images are uploaded to each platform's CDN
4. Platform CDN URLs are cached so re-publishing doesn't re-upload

---

## Notion Database Schema

### Posts DB (`BlogCast Posts`)

| Property | Type |
|---|---|
| Title | Title |
| Slug | Text |
| Status | Select: Draft / Review / Scheduled / Published / Failed / Archived |
| Publish To | Multi-select: devto, hashnode, medium |
| Scheduled At | Date |
| Tags | Multi-select |
| Canonical URL | URL |
| Cover Image | Files |
| Excerpt | Text |
| Published At | Date |
| Word Count | Number |
| Last Synced | Date |

### Analytics DB (`BlogCast Analytics`)

| Property | Type |
|---|---|
| Name | Title |
| Post | Relation → Posts DB |
| Platform | Select |
| Status | Select: Success / Failed / Pending |
| Published URL | URL |
| Error Message | Text |
| Published At | Date |
| Reactions | Number |
| Page Views | Number |
| Comments | Number |

> All columns are auto-created when you first configure Notion credentials. No manual database setup required.

---

## Environment Variables

Almost nothing needs to go in `.env`. All credentials and settings are configured through the **Settings page** (`localhost:5173/settings`) and stored encrypted on your local machine.

The only optional env vars are:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `STORAGE_PATH` | `./storage` | Local storage for images, queue, logs |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `BACKEND_URL` | `http://localhost:3001` | MCP server → backend URL |
| `NOTION_API_KEY` | _(from Settings)_ | CI/Docker override |
| `NOTION_POSTS_DB_ID` | _(from Settings)_ | CI/Docker override |
| `NOTION_ANALYTICS_DB_ID` | _(from Settings)_ | CI/Docker override |
| `ANTHROPIC_API_KEY` | _(from Settings)_ | CI/Docker override |

See [`.env.example`](.env.example) for the template.

---

## Supported Platforms

| Platform | Status | Notes |
|---|---|---|
| Dev.to | ✅ Full support | |
| Hashnode | ✅ Full support | |
| Medium | ✅ Draft support | Medium API only allows draft publishing — publish manually from your Medium dashboard |
| LinkedIn | 🔜 v1.1 | |
| Ghost | 🔜 v2.0 | |
| WordPress | 🔜 v2.0 | |

---

## License

MIT — built with ❤️ by [THECODEDANIEL LIMITED](https://thecodedaniel.com)

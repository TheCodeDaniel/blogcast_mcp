# BlogCast MCP

> One post. Every platform. Powered by Notion + Claude.

BlogCast MCP is an open-source Model Context Protocol server that turns Notion into a headless CMS and publishing hub. Write once in Notion, then use Claude (or the dashboard) to publish simultaneously to Dev.to, Hashnode, and more.

---

## What's Inside

| Package | Description | Port |
|---|---|---|
| `mcp/` | MCP server — Claude integration layer | stdio |
| `server/` | Express.js backend — publishing, images, scheduling | 3001 |
| `client/` | React dashboard — GUI alternative to Claude | 5173 |

---

## Quickstart

### Prerequisites

- Node.js 20+, npm 10+
- A Notion account with API access
- Claude Desktop (for MCP)

### 1. Clone & install

```bash
git clone https://github.com/thecodedaniel/blogcast-mcp.git
cd blogcast
npm install
```

### 2. Set up Notion

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration
2. Duplicate the BlogCast Notion template *(link in BLOGCAST_SPEC.md)*
3. Share both databases (Posts + Analytics) with your integration
4. Copy the database IDs from the page URLs

### 3. Configure environment

```bash
cp .env.example .env
# Fill in NOTION_API_KEY, NOTION_POSTS_DB_ID, NOTION_ANALYTICS_DB_ID
```

### 4. Run everything

```bash
npm run dev          # starts server (3001) + client (5173)
```

Or run individually:

```bash
npm run dev:server   # Express backend only
npm run dev:client   # React dashboard only
npm run dev:mcp      # MCP server only (for testing)
```

### 5. Build the MCP server

```bash
npm run build:mcp
```

### 6. Connect Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "blogcast": {
      "command": "node",
      "args": ["/absolute/path/to/blogcast/mcp/dist/index.js"],
      "env": {
        "NOTION_API_KEY": "your_key",
        "NOTION_POSTS_DB_ID": "your_posts_db_id",
        "NOTION_ANALYTICS_DB_ID": "your_analytics_db_id",
        "BACKEND_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 7. Add platform credentials

Via Claude:
```
Add my Dev.to API key to BlogCast
```

Or via the Platforms page at `localhost:5173/platforms`.

---

## MCP Tools

| Tool | Description |
|---|---|
| `list_drafts` | List posts by status (Draft, Review, Scheduled, all) |
| `preview_post` | Fetch post content as Markdown without publishing |
| `publish_post` | Publish to Dev.to + Hashnode (with image handling) |
| `get_publish_status` | Check publish status + analytics per platform |
| `schedule_post` | Set a scheduled publish time on a post |
| `sync_analytics` | Pull latest views/reactions/comments into Notion |
| `manage_platforms` | Add/remove/test platform API credentials |

### Example Claude conversations

```
"Show me my draft posts"
"Preview my latest Notion draft"
"Publish my post about TypeScript to Dev.to and Hashnode"
"What's the status of my last post?"
"Schedule my React post for tomorrow at 9am UTC on all platforms"
"Add my Hashnode API key"
```

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
  ├── Publishers: Dev.to, Hashnode
  ├── Image service (download → cache → re-upload)
  ├── Format service (Markdown ↔ HTML)
  ├── Auth vault (encrypted local credentials)
  └── Scheduler (auto-publish at scheduled time)
        │
        ▼
Local Storage (./storage/)
  ├── images/   — cached images with deduplication
  ├── queue/    — pending publish jobs
  └── logs/     — winston logs

React Dashboard (localhost:5173)
  — GUI alternative to Claude
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
| Publish To | Multi-select: devto, hashnode |
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

---

## Environment Variables

See [`.env.example`](.env.example) for the full list.

---

## v1.0 Supported Platforms

| Platform | Status |
|---|---|
| Dev.to | ✅ Full support |
| Hashnode | ✅ Full support |
| Medium | 🔜 v1.1 |
| LinkedIn | 🔜 v1.1 |
| Ghost | 🔜 v2.0 |
| WordPress | 🔜 v2.0 |

---

## License

MIT — built with ❤️ by [THECODEDANIEL LIMITED](https://thecodedaniel.com)

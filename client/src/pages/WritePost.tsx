import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TurndownService from "turndown";
import {
  Save,
  Send,
  ChevronRight,
  Sparkles,
  X,
  Info,
} from "lucide-react";
import { Editor } from "../components/Editor";
import { PublishProgress } from "../components/PublishProgress";
import { createPost, publishPost, enhancePost, getConfig } from "../lib/api";
import type { PublishResult } from "../lib/types";

// ── Turndown: HTML → Markdown ─────────────────────────────────────────────────

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  fence: "```",
  bulletListMarker: "-",
});

// Preserve language class on fenced code blocks
td.addRule("codeBlock", {
  filter: (node: any) =>
    node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
  replacement: (_content: string, node: any) => {
    const code = node.firstChild as Element;
    const lang = code.className?.match(/language-(\S+)/)?.[1] ?? "";
    const text = code.textContent ?? "";
    return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
  },
});

const PLATFORMS = [
  { id: "devto",    label: "Dev.to" },
  { id: "hashnode", label: "Hashnode" },
  { id: "medium",   label: "Medium", note: "Draft only" },
];

// ── Tag chip input ────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 bg-brand-50 text-brand-700 text-xs px-2 py-0.5 rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="hover:text-brand-900"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && !input && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={tags.length < 5 ? "Add tag, press Enter" : "Max 5 tags"}
        disabled={tags.length >= 5}
        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function WritePost() {
  const navigate = useNavigate();

  // Content state
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [excerpt, setExcerpt] = useState("");
  const [status, setStatus] = useState<"Draft" | "Review">("Draft");
  const [publishTo, setPublishTo] = useState<string[]>(["devto", "hashnode"]);
  const [canonicalUrl, setCanonicalUrl] = useState("");

  // Action state
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [publishDone, setPublishDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    getConfig()
      .then((cfg) => setAiEnabled(cfg.anthropicConfigured))
      .catch(() => {});
  }, []);

  // Live word count (rough, excludes code blocks)
  const wordCount = html
    .replace(/<pre[\s\S]*?<\/pre>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const getMarkdown = useCallback(() => td.turndown(html || ""), [html]);

  const togglePlatform = (id: string) => {
    setPublishTo((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleEnhance = async () => {
    const markdown = getMarkdown();
    if (!title || !markdown) return;
    setEnhancing(true);
    try {
      const result = await enhancePost({ title, content: markdown });
      if (result.excerpt && !excerpt) setExcerpt(result.excerpt);
      if (result.tags.length > 0 && tags.length === 0) setTags(result.tags);
    } catch {
      // silently ignore
    } finally {
      setEnhancing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim() || !html.trim()) {
      setError("Please add a title and some content before saving.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createPost({
        title,
        content_markdown: getMarkdown(),
        tags,
        excerpt,
        status,
        publishTo,
        canonicalUrl: canonicalUrl.trim() || undefined,
      });
      navigate("/posts");
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPublish = async () => {
    if (!title.trim() || !html.trim()) {
      setError("Please add a title and some content before publishing.");
      return;
    }
    if (publishTo.length === 0) {
      setError("Select at least one platform to publish to.");
      return;
    }

    setPublishing(true);
    setPublishResults([]);
    setPublishDone(false);
    setError(null);

    const markdown = getMarkdown();

    try {
      // 1. Create Notion page
      const { id: postId } = await createPost({
        title,
        content_markdown: markdown,
        tags,
        excerpt,
        status: "Draft",
        publishTo,
        canonicalUrl: canonicalUrl.trim() || undefined,
      });

      // 2. Publish — pass content directly (no need to re-fetch from Notion)
      const res = await publishPost(postId, publishTo, markdown);
      setPublishResults(res.results);
      setPublishDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <button
          onClick={() => navigate("/posts")}
          className="hover:text-gray-600"
        >
          Posts
        </button>
        <ChevronRight size={14} />
        <span className="text-gray-700 font-medium">New post</span>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Main writing area ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="w-full text-3xl font-bold text-gray-900 border-none outline-none placeholder:text-gray-300 bg-transparent leading-tight"
          />

          {/* Editor */}
          <Editor
            onChange={setHtml}
            placeholder="Write your post here. Use the toolbar for headings, code blocks, and more..."
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-400">
              {wordCount > 0 ? `${wordCount.toLocaleString()} words` : "Start writing..."}
            </span>

            <div className="flex items-center gap-3">
              {error && (
                <span className="text-xs text-red-500">{error}</span>
              )}
              <button
                onClick={handleSaveDraft}
                disabled={saving || publishing}
                className="flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "Saving..." : "Save draft"}
              </button>
              <button
                onClick={handleSaveAndPublish}
                disabled={saving || publishing || publishTo.length === 0}
                className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Send size={14} />
                {publishing
                  ? "Publishing..."
                  : `Publish to ${publishTo.length} platform${publishTo.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          {/* Publish results */}
          {(publishing || publishDone) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">Publish results</h2>
              <PublishProgress
                results={publishResults}
                loading={publishing}
                platforms={publishTo}
              />
              {publishDone && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Results logged to your Notion Analytics database.
                  </p>
                  <button
                    onClick={() => navigate("/posts")}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    View all posts →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 space-y-5 sticky top-8">
          {/* Tags */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Tags</h3>
              <span className="text-xs text-gray-400">{tags.length}/5</span>
            </div>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          {/* Excerpt */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Excerpt</h3>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={enhancing || !title}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 disabled:opacity-40"
                  title="Generate excerpt and tags from your content"
                >
                  <Sparkles size={11} />
                  {enhancing ? "Generating..." : "Generate"}
                </button>
              )}
            </div>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short description shown in post listings..."
              maxLength={160}
              rows={3}
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <p className="text-right text-xs text-gray-400">{excerpt.length}/160</p>
          </div>

          {/* Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Status</h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "Draft" | "Review")}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="Draft">Draft</option>
              <option value="Review">Review</option>
            </select>
          </div>

          {/* Publish To */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Publish to</h3>
            <div className="space-y-2">
              {PLATFORMS.map(({ id, label, note }) => (
                <label
                  key={id}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      publishTo.includes(id)
                        ? "bg-brand-500 border-brand-500"
                        : "border-gray-300 group-hover:border-brand-400"
                    }`}
                    onClick={() => togglePlatform(id)}
                  >
                    {publishTo.includes(id) && (
                      <svg viewBox="0 0 12 10" className="w-3 h-3 fill-white">
                        <path
                          d="M1 5l3.5 3.5L11 1"
                          stroke="white"
                          strokeWidth="1.5"
                          fill="none"
                        />
                      </svg>
                    )}
                  </div>
                  <div onClick={() => togglePlatform(id)}>
                    <span className="text-sm text-gray-700">{label}</span>
                    {note && (
                      <span className="ml-1.5 text-xs text-amber-500">{note}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Canonical URL */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-gray-900">Canonical URL</h3>
              <span
                title="Set if this post was originally published elsewhere"
                className="text-gray-400 cursor-help"
              >
                <Info size={12} />
              </span>
            </div>
            <input
              type="url"
              value={canonicalUrl}
              onChange={(e) => setCanonicalUrl(e.target.value)}
              placeholder="https://yourblog.com/post"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

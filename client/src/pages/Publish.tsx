import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, ChevronDown, Info, Zap, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";
import {
  getPosts,
  getPost,
  publishPost as apiPublishPost,
  precheckPost,
  enhancePost,
} from "../lib/api";
import { PublishProgress } from "../components/PublishProgress";
import type { Post, PublishResult } from "../lib/types";

const PLATFORMS = [
  { id: "devto", label: "Dev.to", v1: true },
  { id: "hashnode", label: "Hashnode", v1: true },
  { id: "medium", label: "Medium", v1: true, note: "Publishes as draft — you publish manually from Medium" },
  { id: "linkedin", label: "LinkedIn", v1: false },
  { id: "ghost", label: "Ghost", v1: false },
  { id: "wordpress", label: "WordPress", v1: false },
];

export function Publish() {
  const [searchParams] = useSearchParams();
  const preselectedPostId = searchParams.get("post");

  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string>(
    preselectedPostId ?? ""
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "devto",
    "hashnode",
  ]);
  const [loading, setLoading] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [results, setResults] = useState<PublishResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // AI state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [checkingAI, setCheckingAI] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<string[] | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState<{ excerpt: string; tags: string[] } | null>(null);

  useEffect(() => {
    getPosts({ limit: 50 })
      .then((res) => setPosts(res.posts))
      .catch(() => {})
      .finally(() => setLoadingPosts(false));

    // Check if Anthropic is configured
    fetch("http://localhost:3001/api/config/status")
      .then((r) => r.json())
      .then((data) => setAiEnabled(!!data.anthropic))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (preselectedPostId) {
      setSelectedPostId(preselectedPostId);
    }
  }, [preselectedPostId]);

  // Reset AI state when post changes
  useEffect(() => {
    setAiWarnings(null);
    setEnhanced(null);
  }, [selectedPostId]);

  const selectedPost = posts.find((p) => p.id === selectedPostId);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleRunAICheck = async () => {
    if (!selectedPost) return;
    setCheckingAI(true);
    setAiWarnings(null);

    try {
      // Fetch full post content for the check
      const fullPost = await getPost(selectedPost.id);
      const content = `# ${fullPost.title}\n\n${fullPost.excerpt ?? ""}`;

      const result = await precheckPost({
        title: fullPost.title,
        content,
        tags: fullPost.tags,
        excerpt: fullPost.excerpt ?? "",
      });
      setAiWarnings(result.warnings);
    } catch {
      setAiWarnings([]);
    } finally {
      setCheckingAI(false);
    }
  };

  const handleEnhance = async () => {
    if (!selectedPost) return;
    setEnhancing(true);

    try {
      const fullPost = await getPost(selectedPost.id);
      const content = `# ${fullPost.title}\n\n${fullPost.excerpt ?? ""}`;

      const result = await enhancePost({ title: fullPost.title, content });
      setEnhanced(result);
    } catch {
      // silently fail
    } finally {
      setEnhancing(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedPostId || selectedPlatforms.length === 0) return;

    setLoading(true);
    setResults([]);
    setError(null);
    setDone(false);

    try {
      const res = await apiPublishPost(selectedPostId, selectedPlatforms);
      setResults(res.results);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? "Publish failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Publish Post</h1>
        <p className="text-gray-500 text-sm mt-1">
          Select a Notion draft and choose where to publish it.
        </p>
      </div>

      {/* Post selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">1. Select post</h2>

        <div className="relative">
          <select
            className="w-full appearance-none border border-gray-200 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            value={selectedPostId}
            onChange={(e) => setSelectedPostId(e.target.value)}
            disabled={loadingPosts}
          >
            <option value="">
              {loadingPosts ? "Loading posts..." : "Choose a post..."}
            </option>
            {posts
              .filter((p) => p.status !== "Archived")
              .map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title || "(Untitled)"} — {post.status}
                </option>
              ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            size={16}
          />
        </div>

        {selectedPost && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-gray-700 font-medium">{selectedPost.title}</p>
            {selectedPost.excerpt && (
              <p className="text-gray-500">{selectedPost.excerpt}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedPost.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Platform selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">2. Choose platforms</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PLATFORMS.map(({ id, label, v1, note }) => {
            const checked = selectedPlatforms.includes(id);
            return (
              <button
                key={id}
                onClick={() => v1 && togglePlatform(id)}
                disabled={!v1}
                title={note}
                className={`flex flex-col gap-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all text-left ${
                  !v1
                    ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400"
                    : checked
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked ? "bg-brand-500 border-brand-500" : "border-gray-300"
                    }`}
                  >
                    {checked && (
                      <svg viewBox="0 0 12 10" className="w-3 h-3 fill-white">
                        <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.5" fill="none" />
                      </svg>
                    )}
                  </span>
                  {label}
                  {!v1 && (
                    <span className="text-xs text-gray-400 ml-auto">v1.1</span>
                  )}
                </span>
                {note && v1 && (
                  <span className="text-xs text-amber-600 font-normal leading-tight pl-6">
                    Draft only
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Info size={12} className="shrink-0 mt-0.5" />
          LinkedIn, Ghost, and WordPress support is coming in v1.1.
        </div>
      </div>

      {/* AI pre-publish check */}
      {aiEnabled && selectedPost && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-brand-500" />
              <h2 className="font-semibold text-gray-900">3. AI pre-publish check</h2>
            </div>
            <div className="flex items-center gap-2">
              {!selectedPost.excerpt && (
                <button
                  onClick={handleEnhance}
                  disabled={enhancing}
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 border border-brand-200 hover:border-brand-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  {enhancing ? "Generating..." : "Generate excerpt & tags"}
                </button>
              )}
              <button
                onClick={handleRunAICheck}
                disabled={checkingAI}
                className="flex items-center gap-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap size={12} />
                {checkingAI ? "Checking..." : "Run AI check"}
              </button>
            </div>
          </div>

          {enhanced && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-2">
              <p className="font-medium text-blue-800 text-xs uppercase tracking-wide">AI-generated suggestions</p>
              {enhanced.excerpt && (
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-0.5">Excerpt</p>
                  <p className="text-blue-900 text-sm">{enhanced.excerpt}</p>
                </div>
              )}
              {enhanced.tags.length > 0 && (
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {enhanced.tags.map((tag) => (
                      <span key={tag} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-blue-500">Copy these into your Notion page to apply them.</p>
            </div>
          )}

          {aiWarnings !== null && (
            aiWarnings.length === 0 ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                <CheckCircle size={14} className="shrink-0" />
                Looks good! No issues found.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-amber-700 text-sm font-medium">
                  <AlertTriangle size={14} />
                  {aiWarnings.length} issue{aiWarnings.length !== 1 ? "s" : ""} found
                </div>
                <ul className="space-y-1.5">
                  {aiWarnings.map((warning, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" />
                      {warning}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400">You can still publish with warnings — they're just suggestions.</p>
              </div>
            )
          )}
        </div>
      )}

      {/* Publish button */}
      <button
        onClick={handlePublish}
        disabled={!selectedPostId || selectedPlatforms.length === 0 || loading}
        className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors"
      >
        <Send size={16} />
        {loading
          ? "Publishing..."
          : `Publish to ${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? "s" : ""}`}
      </button>

      {/* Results */}
      {(loading || done) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Publish results</h2>
          <PublishProgress
            results={results}
            loading={loading}
            platforms={selectedPlatforms}
          />
          {done && (
            <p className="text-xs text-gray-400">
              Results have been logged to your Notion Analytics database.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

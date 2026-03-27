import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, ChevronDown, Info } from "lucide-react";
import { getPosts, publishPost as apiPublishPost } from "../lib/api";
import { PublishProgress } from "../components/PublishProgress";
import type { Post, PublishResult } from "../lib/types";

const PLATFORMS = [
  { id: "devto", label: "Dev.to", v1: true },
  { id: "hashnode", label: "Hashnode", v1: true },
  { id: "medium", label: "Medium", v1: false },
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

  useEffect(() => {
    getPosts({ limit: 50 })
      .then((res) => setPosts(res.posts))
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, []);

  useEffect(() => {
    if (preselectedPostId) {
      setSelectedPostId(preselectedPostId);
    }
  }, [preselectedPostId]);

  const selectedPost = posts.find((p) => p.id === selectedPostId);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
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
          {PLATFORMS.map(({ id, label, v1 }) => {
            const checked = selectedPlatforms.includes(id);
            return (
              <button
                key={id}
                onClick={() => v1 && togglePlatform(id)}
                disabled={!v1}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  !v1
                    ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400"
                    : checked
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    checked
                      ? "bg-brand-500 border-brand-500"
                      : "border-gray-300"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 12 10" className="w-3 h-3 fill-white">
                      <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.5" fill="none" />
                    </svg>
                  )}
                </div>
                {label}
                {!v1 && (
                  <span className="text-xs text-gray-400 ml-auto">v1.1</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Info size={12} className="shrink-0 mt-0.5" />
          Medium, LinkedIn, Ghost, and WordPress support is coming in v1.1.
        </div>
      </div>

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

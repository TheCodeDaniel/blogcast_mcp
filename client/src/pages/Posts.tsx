import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, RefreshCw } from "lucide-react";
import { getPosts } from "../lib/api";
import { PostCard } from "../components/PostCard";
import type { Post, PostStatus } from "../lib/types";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "Draft", label: "Drafts" },
  { value: "Review", label: "In Review" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Published", label: "Published" },
  { value: "Failed", label: "Failed" },
  { value: "Archived", label: "Archived" },
];

export function Posts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const statusFilter = searchParams.get("status") ?? "";

  const loadPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPosts({
        status: statusFilter || undefined,
        limit: 50,
      });
      setPosts(res.posts);
    } catch (err: any) {
      setError(err.message ?? "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [statusFilter]);

  const filtered = search
    ? posts.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : posts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
        <button
          onClick={loadPosts}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if (opt.value) {
                  setSearchParams({ status: opt.value });
                } else {
                  setSearchParams({});
                }
              }}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === opt.value
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading posts...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">
            {search ? `No posts matching "${search}"` : "No posts found."}
          </p>
          {!search && (
            <p className="text-sm text-gray-400 mt-2">
              Write a post in your Notion BlogCast database and it will appear
              here.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onClick={() => navigate(`/publish?post=${post.id}`)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Showing {filtered.length} of {posts.length} posts
      </p>
    </div>
  );
}

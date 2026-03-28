import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { getPosts, getPlatforms, getHealth } from "../lib/api";
import { AnalyticsChart } from "../components/AnalyticsChart";
import type { Post, PlatformInfo } from "../lib/types";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [postsRes, platformsRes, healthRes] = await Promise.allSettled([
          getPosts({ limit: 50 }),
          getPlatforms(),
          getHealth(),
        ]);

        if (postsRes.status === "fulfilled") setPosts(postsRes.value.posts);
        if (platformsRes.status === "fulfilled") setPlatforms(platformsRes.value);
        setServerOk(healthRes.status === "fulfilled");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const published = posts.filter((p) => p.status === "Published").length;
  const drafts = posts.filter((p) => p.status === "Draft" || p.status === "Review").length;
  const failed = posts.filter((p) => p.status === "Failed").length;
  const scheduled = posts.filter((p) => p.status === "Scheduled").length;
  const activePlatforms = platforms.filter((p) => p.configured).length;

  const recentPosts = [...posts]
    .sort(
      (a, b) =>
        new Date(b.lastEditedTime).getTime() -
        new Date(a.lastEditedTime).getTime()
    )
    .slice(0, 5);

  // Build chart data from configured platforms
  const chartData = platforms
    .filter((p) => p.configured)
    .map((p) => ({
      platform: p.platform,
      views: 0,
      reactions: 0,
      comments: 0,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {serverOk === false && (
              <span className="text-red-500 font-medium">
                Backend offline — start the server with{" "}
                <code className="bg-gray-100 px-1 rounded">npm run dev:server</code>
              </span>
            )}
            {serverOk === true && "BlogCast is running."}
          </p>
        </div>
        <Link
          to="/publish"
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Publish Post
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<FileText size={18} className="text-blue-600" />}
          label="Total posts"
          value={posts.length}
          color="bg-blue-50"
        />
        <StatCard
          icon={<CheckCircle size={18} className="text-green-600" />}
          label="Published"
          value={published}
          color="bg-green-50"
        />
        <StatCard
          icon={<FileText size={18} className="text-gray-500" />}
          label="Drafts"
          value={drafts}
          color="bg-gray-50"
        />
        <StatCard
          icon={<Clock size={18} className="text-blue-500" />}
          label="Scheduled"
          value={scheduled}
          color="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-sky-600" />}
          label="Active platforms"
          value={activePlatforms}
          color="bg-sky-50"
        />
      </div>

      {failed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-medium text-red-800">
              {failed} post{failed > 1 ? "s" : ""} failed to publish
            </p>
            <Link
              to="/posts?status=Failed"
              className="text-sm text-red-600 hover:underline"
            >
              View failed posts →
            </Link>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-4">Recent posts</h2>
          {recentPosts.length === 0 ? (
            <div className="flex-1 space-y-4">
              <p className="text-sm text-gray-500">
                No posts yet. Here's how to create your first one in Notion:
              </p>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-semibold">1</span>
                  <span>
                    Open your{" "}
                    <a href="https://www.notion.so" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">
                      Notion workspace
                    </a>{" "}
                    and find your <strong>BlogCast Posts</strong> database
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-semibold">2</span>
                  <span>
                    Click <strong>+ New</strong> to create a page — write your post content inside it
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-semibold">3</span>
                  <span>
                    Fill in the page properties: <strong>Title</strong>, <strong>Tags</strong>, <strong>Publish To</strong> (devto, hashnode, medium), and <strong>Excerpt</strong>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-semibold">4</span>
                  <span>
                    Set <strong>Status</strong> to <em>Draft</em> — it'll appear here automatically
                  </span>
                </li>
              </ol>
              <div className="flex items-center gap-3 mt-2">
                <Link
                  to="/write"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline font-medium"
                >
                  Write in the app →
                </Link>
                <span className="text-gray-300">or</span>
                <a
                  href="https://www.notion.so"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 font-medium"
                >
                  <ExternalLink size={13} />
                  Open Notion
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/posts`}
                  className="flex items-center justify-between text-sm group"
                >
                  <span className="text-gray-700 group-hover:text-brand-600 truncate">
                    {post.title || "(Untitled)"}
                  </span>
                  <span
                    className={`shrink-0 ml-3 text-xs px-2 py-0.5 rounded-full ${
                      post.status === "Published"
                        ? "bg-green-100 text-green-700"
                        : post.status === "Failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {post.status}
                  </span>
                </Link>
              ))}
              <div className="pt-3 border-t border-gray-100">
                <Link
                  to="/write"
                  className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1"
                >
                  <ExternalLink size={11} />
                  Write a new post
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Analytics chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Platform analytics
          </h2>
          <AnalyticsChart data={chartData} />
        </div>
      </div>

      {/* Upcoming scheduled */}
      {scheduled > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Upcoming scheduled posts
          </h2>
          <div className="space-y-2">
            {posts
              .filter((p) => p.status === "Scheduled" && p.scheduledAt)
              .sort(
                (a, b) =>
                  new Date(a.scheduledAt!).getTime() -
                  new Date(b.scheduledAt!).getTime()
              )
              .map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-700">
                    {post.title || "(Untitled)"}
                  </span>
                  <span className="text-gray-400">
                    {new Date(post.scheduledAt!).toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

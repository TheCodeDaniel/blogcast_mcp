import { Clock, Tag, Globe } from "lucide-react";
import type { Post } from "../lib/types";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Review: "bg-yellow-100 text-yellow-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Published: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
  Archived: "bg-gray-100 text-gray-500",
};

interface PostCardProps {
  post: Post;
  onClick?: () => void;
}

export function PostCard({ post, onClick }: PostCardProps) {
  const statusClass = STATUS_COLORS[post.status] ?? "bg-gray-100 text-gray-700";
  const edited = new Date(post.lastEditedTime).toLocaleDateString();

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
          {post.title || "(Untitled)"}
        </h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${statusClass}`}
        >
          {post.status}
        </span>
      </div>

      {post.excerpt && (
        <p className="mt-2 text-sm text-gray-500 line-clamp-2">{post.excerpt}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
        {post.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="flex items-center gap-1">
            <Tag size={10} />
            {tag}
          </span>
        ))}

        {post.publishTo.length > 0 && (
          <span className="flex items-center gap-1">
            <Globe size={10} />
            {post.publishTo.join(", ")}
          </span>
        )}

        <span className="flex items-center gap-1 ml-auto">
          <Clock size={10} />
          {edited}
        </span>
      </div>
    </div>
  );
}

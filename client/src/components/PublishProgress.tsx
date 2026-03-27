import { CheckCircle, XCircle, Loader } from "lucide-react";
import type { PublishResult } from "../lib/types";

interface PublishProgressProps {
  results: PublishResult[];
  loading?: boolean;
  platforms?: string[];
}

const PLATFORM_LABELS: Record<string, string> = {
  devto: "Dev.to",
  hashnode: "Hashnode",
  medium: "Medium",
  linkedin: "LinkedIn",
  ghost: "Ghost",
  wordpress: "WordPress",
};

export function PublishProgress({ results, loading, platforms = [] }: PublishProgressProps) {
  // Show loading state for platforms not yet in results
  const resultPlatforms = results.map((r) => r.platform);
  const pendingPlatforms = platforms.filter((p) => !resultPlatforms.includes(p));

  return (
    <div className="space-y-3">
      {results.map((result) => (
        <div
          key={result.platform}
          className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
        >
          {result.success ? (
            <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={18} />
          ) : (
            <XCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          )}
          <div className="min-w-0">
            <p className="font-medium text-sm text-gray-900">
              {PLATFORM_LABELS[result.platform] ?? result.platform}
            </p>
            {result.success && result.url ? (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline truncate block"
              >
                {result.url}
              </a>
            ) : result.error ? (
              <p className="text-xs text-red-500">{result.error}</p>
            ) : null}
          </div>
        </div>
      ))}

      {loading &&
        pendingPlatforms.map((p) => (
          <div key={p} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
            <Loader className="text-gray-400 shrink-0 animate-spin" size={18} />
            <p className="font-medium text-sm text-gray-500">
              Publishing to {PLATFORM_LABELS[p] ?? p}...
            </p>
          </div>
        ))}
    </div>
  );
}

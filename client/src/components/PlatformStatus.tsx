import { CheckCircle, XCircle, Zap } from "lucide-react";
import type { PlatformInfo } from "../lib/types";

const PLATFORM_LABELS: Record<string, string> = {
  devto: "Dev.to",
  hashnode: "Hashnode",
  medium: "Medium",
  linkedin: "LinkedIn",
  ghost: "Ghost",
  wordpress: "WordPress",
};

interface PlatformStatusProps {
  platform: PlatformInfo;
  onTest?: () => void;
  onConfigure?: () => void;
}

export function PlatformStatus({ platform, onTest, onConfigure }: PlatformStatusProps) {
  const label = PLATFORM_LABELS[platform.platform] ?? platform.platform;
  const isV1 = platform.v1Supported;

  return (
    <div
      className={`bg-white rounded-xl border p-5 ${
        !isV1 ? "opacity-60" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {platform.configured ? (
            <CheckCircle className="text-green-500" size={20} />
          ) : (
            <XCircle className="text-gray-300" size={20} />
          )}
          <div>
            <p className="font-semibold text-gray-900">{label}</p>
            <p className="text-xs text-gray-400">
              {!isV1
                ? "Coming in v1.1"
                : platform.configured
                ? "Configured"
                : "Not configured"}
            </p>
          </div>
        </div>

        {isV1 && (
          <div className="flex gap-2">
            {platform.configured && onTest && (
              <button
                onClick={onTest}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"
              >
                <Zap size={12} />
                Test
              </button>
            )}
            <button
              onClick={onConfigure}
              className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white"
            >
              {platform.configured ? "Edit" : "Configure"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

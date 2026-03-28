import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartDataPoint {
  platform: string;
  views: number;
  reactions: number;
  comments: number;
}

interface AnalyticsChartProps {
  data: ChartDataPoint[];
}

export function AnalyticsChart({ data }: AnalyticsChartProps) {
  const hasData =
    data.length > 0 &&
    data.some((d) => d.views > 0 || d.reactions > 0 || d.comments > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm gap-2">
        <p>No analytics data yet.</p>
        <p className="text-xs text-center">
          Publish a post, then use <span className="font-mono bg-gray-100 px-1 rounded">sync_analytics</span> via Claude or the Posts page to pull in stats.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="platform"
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "12px",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Bar dataKey="views" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Views" />
        <Bar dataKey="reactions" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Reactions" />
        <Bar dataKey="comments" fill="#10b981" radius={[4, 4, 0, 0]} name="Comments" />
      </BarChart>
    </ResponsiveContainer>
  );
}

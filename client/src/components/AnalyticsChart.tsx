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
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No analytics data yet. Publish your first post to see stats here.
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

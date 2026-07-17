"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DistanceBucketAggregate } from "@/lib/analytics/aggregations";

const COLORS = ["#7B1E1E", "#9B2A2A", "#D4A24C", "#5B1414"];

export function DistancePieChart({ data }: { data: DistanceBucketAggregate[] }) {
  const sliced = data.filter((d) => d.count > 0);
  if (sliced.length === 0) {
    return (
      <div className="grid h-72 w-full place-items-center text-sm text-muted-foreground">
        No distance data yet.
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={sliced}
            dataKey="count"
            nameKey="bucket"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
          >
            {sliced.map((entry, i) => (
              <Cell key={entry.bucket} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

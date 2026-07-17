"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/analytics/aggregations";
import { format, parseISO } from "date-fns";

interface Props {
  data: DailyPoint[];
}

export function DailyTrendChart({ data }: Props) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="customers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7B1E1E" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#7B1E1E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => format(parseISO(d), "d MMM")}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickMargin={6}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickMargin={6} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(d: string) => format(parseISO(d), "EEE, d MMM yyyy")}
            formatter={(value: number, name: string) => [value, name === "count" ? "Customers" : name]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#7B1E1E"
            strokeWidth={2}
            fill="url(#customers)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

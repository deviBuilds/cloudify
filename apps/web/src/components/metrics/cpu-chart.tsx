"use client";

import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  time: string;
  value: number;
}

const MAX_POINTS = 60;

interface CpuChartProps {
  title: string;
  currentValue: number;
  sourceId: string;
}

export function CpuChart({ title, currentValue, sourceId }: CpuChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const lastSourceRef = useRef(sourceId);

  useEffect(() => {
    if (lastSourceRef.current !== sourceId) {
      setData([]);
      lastSourceRef.current = sourceId;
    }
  }, [sourceId]);

  useEffect(() => {
    const now = new Date();
    const timeLabel = `${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    setData((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].time === timeLabel) return prev;
      const next = [...prev, { time: timeLabel, value: currentValue }];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }, [currentValue]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#888" }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#888" }}
              tickFormatter={(v) => `${v}%`}
              width={40}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 6,
                fontSize: 12,
                color: "#eee",
              }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "CPU"]}
              labelStyle={{ color: "#999" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#3b82f6", stroke: "#3b82f6" }}
              activeDot={{ r: 5, fill: "#60a5fa", stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

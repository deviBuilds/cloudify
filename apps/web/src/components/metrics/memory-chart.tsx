"use client";

import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  time: string;
  used: number;
  limit: number;
}

const MAX_POINTS = 60;

interface MemoryChartProps {
  title: string;
  usedBytes: number;
  limitBytes: number;
  sourceId: string;
}

export function MemoryChart({
  title,
  usedBytes,
  limitBytes,
  sourceId,
}: MemoryChartProps) {
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
    const usedMB = usedBytes / 1024 / 1024;
    const limitMB = limitBytes / 1024 / 1024;

    setData((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].time === timeLabel) return prev;
      const next = [...prev, { time: timeLabel, used: usedMB, limit: limitMB }];
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
  }, [usedBytes, limitBytes]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#888" }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            />
            <YAxis
              domain={[0, (max: number) => Math.ceil(max * 1.1)]}
              tick={{ fontSize: 10, fill: "#888" }}
              tickFormatter={(v) => `${Math.round(v)}`}
              width={45}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              label={{
                value: "MB",
                position: "insideTopLeft",
                offset: -5,
                style: { fontSize: 10, fill: "#888" },
              }}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 6,
                fontSize: 12,
                color: "#eee",
              }}
              formatter={(v: number, name: string) => [
                `${Math.round(v)} MB`,
                name === "used" ? "Used" : "Limit",
              ]}
              labelStyle={{ color: "#999" }}
            />
            <Area
              type="monotone"
              dataKey="limit"
              stroke="#666"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="none"
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="used"
              stroke="#22c55e"
              fill="rgba(34,197,94,0.15)"
              strokeWidth={2}
              dot={{ r: 3, fill: "#22c55e", stroke: "#22c55e" }}
              activeDot={{ r: 5, fill: "#4ade80", stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

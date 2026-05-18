"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  formattedValue?: string;
  trend?: {
    value: number; // percentage e.g. 12.5 means +12.5%
    label?: string;
  };
  icon?: React.ReactNode;
  sparklineData?: number[];
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────

export function KPICard({
  label,
  value,
  formattedValue,
  trend,
  icon,
  sparklineData,
  className,
}: KPICardProps) {
  const isPositive = trend ? trend.value >= 0 : true;

  // Convert sparkline array to recharts format
  const chartData = sparklineData?.map((v, i) => ({ idx: i, value: v }));

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">
              {formattedValue ?? String(value)}
            </p>
            {trend && (
              <div className="flex items-center gap-1 pt-0.5">
                {isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    isPositive ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {trend.value.toFixed(1)}%
                </span>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">
                    {trend.label}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
              </div>
            )}
          </div>
        </div>

        {/* Sparkline */}
        {chartData && chartData.length > 1 && (
          <div className="mt-4 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`sparkGrad-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={isPositive ? "#10b981" : "#ef4444"}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={isPositive ? "#10b981" : "#ef4444"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? "#10b981" : "#ef4444"}
                  strokeWidth={1.5}
                  fill={`url(#sparkGrad-${label})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

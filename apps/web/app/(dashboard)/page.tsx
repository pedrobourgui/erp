"use client";

import React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KPICard } from "@/components/charts/kpi-card";
import { formatCurrency } from "@/lib/utils";
import {
  useDashboardData,
  type DashboardKPI,
  type SalesTrendPoint,
} from "@/hooks/use-dashboard";
import { useRecentOrders, type OrderListItem } from "@/hooks/use-orders";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// ─── Shared chart tooltip style ──────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.625rem",
  boxShadow: "0 4px 12px hsl(225 33% 10% / 0.1)",
  fontSize: "13px",
};

// ─── Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: dashResp, isLoading: dashLoading } = useDashboardData();
  const { data: recentOrdersResp, isLoading: ordersLoading } = useRecentOrders(5);

  const kpis = dashResp?.data?.kpis;
  const ordersByStatus = dashResp?.data?.ordersByStatus ?? [];
  const salesTrend = dashResp?.data?.salesTrend ?? [];
  const recentOrders = recentOrdersResp?.data ?? [];

  return (
    <div className="space-y-8">
      <div className="animate-slide-up">
        <h1 className="text-3xl font-bold tracking-tight font-heading">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Visão geral do seu negócio</p>
      </div>

      <KPISection kpis={kpis} isLoading={dashLoading} />

      <SalesTrendSection data={salesTrend} isLoading={dashLoading} />

      <div className="grid gap-5 lg:grid-cols-3">
        <RecentOrdersSection orders={recentOrders} isLoading={ordersLoading} />
        <OrdersByStatusSection data={ordersByStatus} isLoading={dashLoading} />
      </div>
    </div>
  );
}

// ─── KPI Section ────────────────────────────────────────────────────────

function KPISection({
  kpis,
  isLoading,
}: {
  kpis: DashboardKPI | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !kpis) {
    return (
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
      <div className="animate-slide-up stagger-1">
        <KPICard
          label="Vendas do Dia"
          value={kpis.todaySales.value}
          formattedValue={formatCurrency(kpis.todaySales.value)}
          icon={<DollarSign className="h-5 w-5" />}
          sparklineData={kpis.todaySales.sparkline}
        />
      </div>
      <div className="animate-slide-up stagger-2">
        <KPICard
          label="Ticket Médio"
          value={kpis.avgTicket.value}
          formattedValue={formatCurrency(kpis.avgTicket.value)}
          trend={
            kpis.avgTicket.trend !== undefined
              ? { value: kpis.avgTicket.trend, label: "vs. mês anterior" }
              : undefined
          }
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>
      <div className="animate-slide-up stagger-3">
        <KPICard
          label="A Receber (aberto)"
          value={kpis.receivablesOpen.value}
          formattedValue={formatCurrency(kpis.receivablesOpen.value)}
          icon={<ArrowDownLeft className="h-5 w-5" />}
        />
      </div>
      <div className="animate-slide-up stagger-4">
        <KPICard
          label="A Pagar (aberto)"
          value={kpis.payablesOpen.value}
          formattedValue={formatCurrency(kpis.payablesOpen.value)}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
      </div>
      <div className="animate-slide-up stagger-5">
        <KPICard
          label="Estoque Crítico"
          value={kpis.lowStockAlerts.value}
          formattedValue={`${kpis.lowStockAlerts.value} itens`}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}

// ─── Sales Trend Section ────────────────────────────────────────────────

function SalesTrendSection({
  data,
  isLoading,
}: {
  data: SalesTrendPoint[];
  isLoading: boolean;
}) {
  const hasSales = data.some((d) => d.total > 0);

  return (
    <Card className="animate-slide-up">
      <CardHeader>
        <CardTitle className="text-lg font-heading">Vendas do Período</CardTitle>
        <CardDescription>Faturamento diário dos últimos 14 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[240px] animate-pulse rounded bg-muted" />
        ) : !hasSales ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem vendas no período
          </p>
        ) : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [formatCurrency(v), "Vendas"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#salesTrendFill)"
                  name="Vendas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Recent Orders Section ──────────────────────────────────────────────

function RecentOrdersSection({
  orders,
  isLoading,
}: {
  orders: OrderListItem[];
  isLoading: boolean;
}) {
  return (
    <Card className="lg:col-span-2 animate-slide-up stagger-5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-heading">Pedidos Recentes</CardTitle>
          <CardDescription>Últimos 5 pedidos recebidos</CardDescription>
        </div>
        <Link href="/vendas/pedidos">
          <Button variant="ghost" size="sm" className="group">
            Ver todos
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum pedido recente
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Pedido</th>
                  <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Cliente</th>
                  <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: OrderListItem) => (
                  <tr key={order.id} className="border-b last:border-0 transition-colors hover:bg-muted/50">
                    <td className="py-3.5">
                      <Link href={`/vendas/pedidos/${order.id}`} className="font-medium text-primary hover:underline">
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3.5">{order.customerName}</td>
                    <td className="py-3.5"><StatusBadge status={order.status} /></td>
                    <td className="py-3.5 text-right font-medium tabular-nums">{formatCurrency(order.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Orders by Status Section ───────────────────────────────────────────

function OrdersByStatusSection({
  data,
  isLoading,
}: {
  data: { status: string; label: string; count: number; color: string }[];
  isLoading: boolean;
}) {
  return (
    <Card className="animate-slide-up stagger-6">
      <CardHeader>
        <CardTitle className="text-lg font-heading">Pedidos por Status</CardTitle>
        <CardDescription>Distribuição atual dos pedidos</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[280px] animate-pulse rounded bg-muted" />
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem dados disponíveis
          </p>
        ) : (
          <>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Pedidos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {data.map((item) => (
                <div key={item.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                  </div>
                  <span className="font-medium tabular-nums">{item.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

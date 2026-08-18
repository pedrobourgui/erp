"use client";

import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import React from "react";
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

import { KPICard } from "@/components/charts/kpi-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TruncatedText } from "@/components/ui/truncated-text";
import {
  useDashboardData,
  type DashboardKPI,
  type SalesTrendPoint,
} from "@/hooks/use-dashboard";
import { useRecentOrders, type OrderListItem } from "@/hooks/use-orders";
import { usePermissions } from "@/hooks/use-permissions";
import { cn, formatCurrency, formatDate, pluralize } from "@/lib/utils";


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

/**
 * AE-27/FN-09: a seller reaches the dashboard with `reports:read` and used to
 * read "A Pagar R$ 11.730,00" there. The API already omits those KPIs for them;
 * the grid adapts so the remaining cards fill the row instead of leaving holes.
 */
function KPISection({
  kpis,
  isLoading,
}: {
  kpis: DashboardKPI | undefined;
  isLoading: boolean;
}) {
  const { can } = usePermissions();
  const showFinancial = can("financial:read");
  const showStock = can("inventory:read");

  const cards = [
    kpis && {
      key: "todaySales",
      node: (
        <KPICard
          label="Vendas do Dia"
          value={kpis.todaySales.value}
          formattedValue={formatCurrency(kpis.todaySales.value)}
          icon={<DollarSign className="h-5 w-5" />}
          sparklineData={kpis.todaySales.sparkline}
        />
      ),
    },
    kpis && {
      key: "avgTicket",
      node: (
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
      ),
    },
    kpis && showFinancial && kpis.receivablesOpen && {
      key: "receivablesOpen",
      node: (
        <KPICard
          label="A Receber (aberto)"
          value={kpis.receivablesOpen.value}
          formattedValue={formatCurrency(kpis.receivablesOpen.value)}
          icon={<ArrowDownLeft className="h-5 w-5" />}
        />
      ),
    },
    kpis && showFinancial && kpis.payablesOpen && {
      key: "payablesOpen",
      node: (
        <KPICard
          label="A Pagar (aberto)"
          value={kpis.payablesOpen.value}
          formattedValue={formatCurrency(kpis.payablesOpen.value)}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
      ),
    },
    kpis && showStock && {
      key: "lowStockAlerts",
      node: (
        <KPICard
          label="Estoque Crítico"
          value={kpis.lowStockAlerts.value}
          formattedValue={pluralize(kpis.lowStockAlerts.value, "item", "itens")}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      ),
    },
  ].filter(Boolean) as { key: string; node: React.ReactNode }[];

  // Literal class names on purpose: Tailwind scans the source, so an
  // interpolated `lg:grid-cols-${n}` would never be generated.
  const COLUMNS_BY_COUNT: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
  };
  // `auto-rows-fr` keeps every KPI the same height, not just the ones sharing a
  // row: at md the grid wraps to two columns and the row with the sparkline
  // would otherwise tower over the one below it.
  const gridClass = cn(
    "grid auto-rows-fr gap-5 md:grid-cols-2",
    COLUMNS_BY_COUNT[Math.min(cards.length, 5)] ?? "lg:grid-cols-5"
  );

  if (isLoading || !kpis) {
    return (
      <div className="grid auto-rows-fr gap-5 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          // 170px is what a KPICard measures now that the row shares one
          // height; h-36 left the grid jumping 26px when the data landed.
          <div key={i} className="h-[170px] animate-pulse rounded-xl border bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {cards.map((card, index) => (
        <div key={card.key} className={`h-full animate-slide-up stagger-${index + 1}`}>
          {card.node}
        </div>
      ))}
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
                  tickFormatter={(v: string) => formatDate(v, "dd/MM")}
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
                {/* AE-22: the axis showed the ISO day (07-31) and the tooltip
                    the full ISO date; both now read as dd/MM in pt-BR. */}
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [formatCurrency(v), "Vendas"]}
                  labelFormatter={(v: string) => formatDate(v)}
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
                    <td className="py-3.5">
                      <TruncatedText text={order.customerName} className="max-w-[32ch]" />
                    </td>
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

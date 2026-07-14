import { Injectable, Logger } from '@nestjs/common';
import { Prisma, FinancialStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

const OPEN_FINANCIAL_STATUSES: FinancialStatus[] = [
  'PENDING',
  'PARTIALLY_PAID',
  'OVERDUE',
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PICKING: 'Separação',
  PACKED: 'Embalado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  RETURNED: 'Devolvido',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PICKING: '#6366f1',
  PACKED: '#8b5cf6',
  SHIPPED: '#0ea5e9',
  DELIVERED: '#10b981',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
  RETURNED: '#f97316',
};

const SALES_TREND_DAYS = 14;

export interface DashboardKpi {
  value: number;
  trend?: number;
  sparkline?: number[];
}

export interface DashboardData {
  kpis: {
    todaySales: DashboardKpi;
    avgTicket: DashboardKpi;
    receivablesOpen: DashboardKpi;
    payablesOpen: DashboardKpi;
    lowStockAlerts: DashboardKpi;
  };
  ordersByStatus: Array<{
    status: string;
    label: string;
    count: number;
    color: string;
  }>;
  salesTrend: Array<{ date: string; total: number }>;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dashboard summary scoped by tenantId (SCRUM-24). Aggregates today's sales,
   * average ticket, open receivables/payables, stock alerts, orders by status
   * and a daily sales series — all computed in the backend.
   */
  async getDashboard(tenantId: string): Promise<DashboardData> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const trendStart = new Date(now.getTime() - (SALES_TREND_DAYS - 1) * 24 * 60 * 60 * 1000);
    const trendDayStart = new Date(
      trendStart.getFullYear(),
      trendStart.getMonth(),
      trendStart.getDate(),
    );

    const [
      currentPeriod,
      previousPeriod,
      todayAgg,
      receivablesAgg,
      payablesAgg,
      lowStockCount,
      ordersByStatusRaw,
      trendOrders,
    ] = await Promise.all([
      this.getOrderMetrics(tenantId, thirtyDaysAgo, now),
      this.getOrderMetrics(tenantId, sixtyDaysAgo, thirtyDaysAgo),
      this.prisma.order.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          createdAt: { gte: todayStart },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.accountsReceivable.aggregate({
        where: { tenantId, status: { in: OPEN_FINANCIAL_STATUSES } },
        _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.accountsPayable.aggregate({
        where: { tenantId, status: { in: OPEN_FINANCIAL_STATUSES } },
        _sum: { amount: true, paidAmount: true },
      }),
      this.prisma.stockAlert.count({ where: { tenantId, isResolved: false } }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
          createdAt: { gte: trendDayStart },
        },
        select: { totalAmount: true, createdAt: true },
      }),
    ]);

    const avgTicket =
      currentPeriod.count > 0 ? currentPeriod.revenue / currentPeriod.count : 0;
    const prevAvgTicket =
      previousPeriod.count > 0 ? previousPeriod.revenue / previousPeriod.count : 0;

    const salesTrend = this.buildSalesTrend(trendDayStart, trendOrders);

    return {
      kpis: {
        todaySales: {
          value: Number(todayAgg._sum.totalAmount ?? 0),
          sparkline: salesTrend.map((d) => d.total),
        },
        avgTicket: {
          value: Number(avgTicket.toFixed(2)),
          trend: this.calculateVariation(avgTicket, prevAvgTicket),
        },
        receivablesOpen: {
          value: this.outstanding(
            receivablesAgg._sum.amount,
            receivablesAgg._sum.paidAmount,
          ),
        },
        payablesOpen: {
          value: this.outstanding(
            payablesAgg._sum.amount,
            payablesAgg._sum.paidAmount,
          ),
        },
        lowStockAlerts: {
          value: lowStockCount,
        },
      },
      ordersByStatus: ordersByStatusRaw
        .map((row) => ({
          status: row.status,
          label: ORDER_STATUS_LABELS[row.status] ?? row.status,
          count: row._count._all,
          color: ORDER_STATUS_COLORS[row.status] ?? '#64748b',
        }))
        .sort((a, b) => b.count - a.count),
      salesTrend,
    };
  }

  /** Outstanding total = Σ amount − Σ paidAmount for the open títulos. */
  private outstanding(
    amountSum: Prisma.Decimal | null,
    paidSum: Prisma.Decimal | null,
  ): number {
    const amount = Number(amountSum ?? 0);
    const paid = Number(paidSum ?? 0);
    return Number(Math.max(0, amount - paid).toFixed(2));
  }

  /** Buckets orders into a daily sales series of SALES_TREND_DAYS entries. */
  private buildSalesTrend(
    start: Date,
    orders: Array<{ totalAmount: Prisma.Decimal; createdAt: Date }>,
  ): Array<{ date: string; total: number }> {
    const buckets: Array<{ date: string; total: number }> = [];
    const keyIndex = new Map<string, number>();

    for (let i = 0; i < SALES_TREND_DAYS; i++) {
      const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      keyIndex.set(key, i);
      buckets.push({ date: key, total: 0 });
    }

    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const idx = keyIndex.get(key);
      if (idx !== undefined) {
        buckets[idx].total = Number(
          (buckets[idx].total + Number(order.totalAmount)).toFixed(2),
        );
      }
    }

    return buckets;
  }

  /** Aggregate order revenue/count for a date range (excludes cancelled/draft). */
  private async getOrderMetrics(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<{ revenue: number; count: number }> {
    const result = await this.prisma.order.aggregate({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: ['CANCELLED', 'DRAFT'] },
        createdAt: { gte: from, lte: to },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    return {
      revenue: Number(result._sum.totalAmount ?? 0),
      count: result._count.id,
    };
  }

  /** Percentage variation between current and previous values. */
  private calculateVariation(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }
}

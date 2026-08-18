import { Injectable, Logger } from '@nestjs/common';
import { Prisma, FinancialStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  shiftDateKey,
  startOfDayInTz,
  toLocalDateKey,
} from '../../common/utils/date-range.util';

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

/** What the caller is allowed to see in the dashboard payload. */
export interface DashboardScope {
  /** Open receivables and payables. Requires `financial:read`. */
  includeFinancial?: boolean;
}

export interface DashboardData {
  kpis: {
    todaySales: DashboardKpi;
    avgTicket: DashboardKpi;
    /** Absent when the caller cannot read the financial module. */
    receivablesOpen?: DashboardKpi;
    /** Absent when the caller cannot read the financial module. */
    payablesOpen?: DashboardKpi;
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
  async getDashboard(
    tenantId: string,
    scope: DashboardScope = {},
  ): Promise<DashboardData> {
    // AE-27/FN-09: a seller reaches this endpoint with `reports:read`, so the
    // financial KPIs must not travel to them at all. Hiding them only in the UI
    // would still ship "A Pagar R$ 11.730,00" in the response body.
    const { includeFinancial = true } = scope;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // "Today" and the trend window are civil days of the tenant, not of the
    // server: `getFullYear()` and friends read the *process* timezone, so a
    // deploy in UTC would show the wrong day's sales (TZ-01).
    const todayKey = toLocalDateKey(now);
    const trendStartKey = shiftDateKey(todayKey, -(SALES_TREND_DAYS - 1));
    const todayStart = startOfDayInTz(todayKey);
    const trendDayStart = startOfDayInTz(trendStartKey);

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
      includeFinancial
        ? this.prisma.accountsReceivable.aggregate({
            where: { tenantId, status: { in: OPEN_FINANCIAL_STATUSES } },
            _sum: { amount: true, paidAmount: true },
          })
        : null,
      includeFinancial
        ? this.prisma.accountsPayable.aggregate({
            where: { tenantId, status: { in: OPEN_FINANCIAL_STATUSES } },
            _sum: { amount: true, paidAmount: true },
          })
        : null,
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

    const salesTrend = this.buildSalesTrend(trendStartKey, trendOrders);

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
        ...(receivablesAgg && payablesAgg
          ? {
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
            }
          : {}),
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

  /**
   * Buckets orders into a daily sales series of SALES_TREND_DAYS entries.
   *
   * Both the buckets and the orders are keyed by the tenant's civil day
   * (`toLocalDateKey`). Keying the orders with `toISOString()` — as this used
   * to do — dropped every sale made after 21:00 in UTC-3 into the next UTC day,
   * where no bucket matched, and the sale vanished from the chart (TZ-01).
   */
  private buildSalesTrend(
    startKey: string,
    orders: Array<{ totalAmount: Prisma.Decimal; createdAt: Date }>,
  ): Array<{ date: string; total: number }> {
    const buckets: Array<{ date: string; total: number }> = [];
    const keyIndex = new Map<string, number>();

    for (let i = 0; i < SALES_TREND_DAYS; i++) {
      const key = shiftDateKey(startKey, i);
      keyIndex.set(key, i);
      buckets.push({ date: key, total: 0 });
    }

    for (const order of orders) {
      const key = toLocalDateKey(order.createdAt);
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

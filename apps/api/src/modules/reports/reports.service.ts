import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

export interface DashboardData {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  ordersToday: number;
  lowStockCount: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    customerName: string | null;
    createdAt: Date;
  }>;
  variation: {
    revenue: number;
    orders: number;
    averageTicket: number;
  };
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard summary data scoped by tenantId.
   * Compares current period (last 30 days) with previous period.
   */
  async getDashboard(tenantId: string): Promise<DashboardData> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Run all queries in parallel for performance
    const [
      currentPeriod,
      previousPeriod,
      ordersToday,
      lowStockCount,
      recentOrders,
    ] = await Promise.all([
      // Current period (last 30 days)
      this.getOrderMetrics(tenantId, thirtyDaysAgo, now),
      // Previous period (30-60 days ago)
      this.getOrderMetrics(tenantId, sixtyDaysAgo, thirtyDaysAgo),
      // Orders created today
      this.prisma.order.count({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: todayStart },
        },
      }),
      // Low stock alerts count
      this.prisma.stockAlert.count({
        where: {
          tenantId,
          isResolved: false,
        },
      }),
      // Recent 5 orders
      this.prisma.order.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

    const totalRevenue = currentPeriod.revenue;
    const totalOrders = currentPeriod.count;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const prevAvgTicket =
      previousPeriod.count > 0
        ? previousPeriod.revenue / previousPeriod.count
        : 0;

    return {
      totalRevenue,
      totalOrders,
      averageTicket,
      ordersToday,
      lowStockCount,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        customerName: o.customer?.name ?? null,
        createdAt: o.createdAt,
      })),
      variation: {
        revenue: this.calculateVariation(totalRevenue, previousPeriod.revenue),
        orders: this.calculateVariation(totalOrders, previousPeriod.count),
        averageTicket: this.calculateVariation(averageTicket, prevAvgTicket),
      },
    };
  }

  /**
   * Get aggregate order metrics for a date range.
   */
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

  /**
   * Calculate percentage variation between current and previous values.
   */
  private calculateVariation(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }
}

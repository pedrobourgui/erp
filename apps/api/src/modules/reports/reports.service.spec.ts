import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService, DashboardData } from './reports.service';
import { PrismaService } from '../../database/prisma/prisma.service';

import { toLocalDateKey } from '../../common/utils/date-range.util';

const TENANT_A = 'tenant-aaa-111';

/**
 * Calendar day in the *tenant's* timezone — the same key the service buckets
 * by. Deriving it from the server's timezone made this suite pass only when the
 * process happened to run in BRT (TZ-01).
 */
const localDateKey = (date: Date) => toLocalDateKey(date);
const TENANT_B = 'tenant-bbb-222';

function createMockPrisma() {
  return {
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    accountsReceivable: { aggregate: jest.fn() },
    accountsPayable: { aggregate: jest.fn() },
    stockAlert: { count: jest.fn() },
  };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getDashboard', () => {
    beforeEach(() => {
      // getOrderMetrics current (30d) then previous (30-60d), then today's sales
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 5000 }, _count: { id: 20 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: 4000 }, _count: { id: 16 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: 750 } }); // today's sales
      prisma.accountsReceivable.aggregate.mockResolvedValue({
        _sum: { amount: 1000, paidAmount: 200 },
      });
      prisma.accountsPayable.aggregate.mockResolvedValue({
        _sum: { amount: 500, paidAmount: 0 },
      });
      prisma.stockAlert.count.mockResolvedValue(4);
      prisma.order.groupBy.mockResolvedValue([
        { status: 'CONFIRMED', _count: { _all: 12 } },
        { status: 'PENDING', _count: { _all: 3 } },
      ]);
      prisma.order.findMany.mockResolvedValue([]);
    });

    it('should return the KPI structure expected by the dashboard', async () => {
      const result: DashboardData = await service.getDashboard(TENANT_A);

      expect(result.kpis).toHaveProperty('todaySales');
      expect(result.kpis).toHaveProperty('avgTicket');
      expect(result.kpis).toHaveProperty('receivablesOpen');
      expect(result.kpis).toHaveProperty('payablesOpen');
      expect(result.kpis).toHaveProperty('lowStockAlerts');
      expect(result).toHaveProperty('ordersByStatus');
      expect(result).toHaveProperty('salesTrend');
    });

    it("should compute today's sales from the day aggregate", async () => {
      const result = await service.getDashboard(TENANT_A);
      expect(result.kpis.todaySales.value).toBe(750);
    });

    it('should compute the average ticket (30d revenue / orders)', async () => {
      const result = await service.getDashboard(TENANT_A);
      expect(result.kpis.avgTicket.value).toBe(250); // 5000 / 20
    });

    it('should compute open receivables as amount minus paidAmount', async () => {
      const result = await service.getDashboard(TENANT_A);
      expect(result.kpis.receivablesOpen?.value).toBe(800); // 1000 - 200
    });

    it('should compute open payables as amount minus paidAmount', async () => {
      const result = await service.getDashboard(TENANT_A);
      expect(result.kpis.payablesOpen?.value).toBe(500);
    });

    it('should return the stock alerts count', async () => {
      const result = await service.getDashboard(TENANT_A);
      expect(result.kpis.lowStockAlerts.value).toBe(4);
    });

    // ─── Scoped payload (lote 4, AE-27/FN-09) ─────────────────────────────

    describe('scope', () => {
      it('omits the financial KPIs for a caller without financial:read', async () => {
        const result = await service.getDashboard(TENANT_A, {
          includeFinancial: false,
        });

        expect(result.kpis.receivablesOpen).toBeUndefined();
        expect(result.kpis.payablesOpen).toBeUndefined();
      });

      it('still returns the sales KPIs a seller needs', async () => {
        const result = await service.getDashboard(TENANT_A, {
          includeFinancial: false,
        });

        expect(result.kpis.todaySales.value).toBe(750);
        expect(result.kpis.avgTicket.value).toBe(250);
        expect(result.salesTrend).toBeDefined();
        expect(result.ordersByStatus.length).toBeGreaterThan(0);
      });

      it('does not even query the financial tables when they are out of scope', async () => {
        await service.getDashboard(TENANT_A, { includeFinancial: false });

        expect(prisma.accountsReceivable.aggregate).not.toHaveBeenCalled();
        expect(prisma.accountsPayable.aggregate).not.toHaveBeenCalled();
      });

      it('includes everything by default', async () => {
        const result = await service.getDashboard(TENANT_A);

        expect(result.kpis.receivablesOpen?.value).toBe(800);
        expect(result.kpis.payablesOpen?.value).toBe(500);
      });
    });

    it('should map and sort ordersByStatus by count desc with labels', async () => {
      const result = await service.getDashboard(TENANT_A);
      expect(result.ordersByStatus[0]).toMatchObject({
        status: 'CONFIRMED',
        label: 'Confirmado',
        count: 12,
      });
      expect(result.ordersByStatus[1].count).toBe(3);
    });

    it('should return a 14-day sales trend series', async () => {
      const result = await service.getDashboard(TENANT_A);
      expect(result.salesTrend).toHaveLength(14);
      expect(result.kpis.todaySales.sparkline).toHaveLength(14);
    });

    it('should bucket trend orders into their day', async () => {
      const today = new Date();
      const key = localDateKey(today);
      prisma.order.findMany.mockReset().mockResolvedValue([
        { totalAmount: 100, createdAt: today },
        { totalAmount: 50, createdAt: today },
      ]);

      const result = await service.getDashboard(TENANT_A);
      const todayBucket = result.salesTrend.find((d) => d.date === key);
      expect(todayBucket?.total).toBe(150);
    });

    // Timezone regression: buckets are built from local midnight, so keying the
    // orders in UTC silently dropped every sale made after 21:00 in UTC-3 —
    // the dashboard showed no sales for the rest of the evening.
    it('should keep late-evening sales in the current local day', async () => {
      jest.useFakeTimers();
      try {
        // 23:30 of 31/07 in America/Sao_Paulo — already 01/08 in UTC. Stated as
        // an absolute instant so the test means the same in every process TZ.
        const lateEvening = new Date('2026-08-01T02:30:00.000Z');
        jest.setSystemTime(lateEvening);

        prisma.order.findMany.mockReset().mockResolvedValue([
          { totalAmount: 100, createdAt: lateEvening },
          { totalAmount: 50, createdAt: lateEvening },
        ]);

        const result = await service.getDashboard(TENANT_A);
        const bucket = result.salesTrend.find((d) => d.date === '2026-07-31');

        expect(bucket?.total).toBe(150);
        expect(result.salesTrend[result.salesTrend.length - 1].date).toBe('2026-07-31');
      } finally {
        jest.useRealTimers();
      }
    });

    it('should scope every query by tenantId', async () => {
      await service.getDashboard(TENANT_A);

      for (const call of prisma.order.aggregate.mock.calls) {
        expect(call[0].where.tenantId).toBe(TENANT_A);
        expect(call[0].where.tenantId).not.toBe(TENANT_B);
      }
      expect(prisma.accountsReceivable.aggregate.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      expect(prisma.accountsPayable.aggregate.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      expect(prisma.stockAlert.count.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      expect(prisma.order.groupBy.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
    });

    it('should only aggregate open financial statuses', async () => {
      await service.getDashboard(TENANT_A);
      const arWhere = prisma.accountsReceivable.aggregate.mock.calls[0][0].where;
      expect(arWhere.status).toEqual({ in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] });
    });

    it('should return zero average ticket when there are no orders', async () => {
      prisma.order.aggregate
        .mockReset()
        .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: { id: 0 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: { id: 0 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: null } });

      const result = await service.getDashboard(TENANT_A);
      expect(result.kpis.avgTicket.value).toBe(0);
    });
  });
});

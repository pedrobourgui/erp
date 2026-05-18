import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService, DashboardData } from './reports.service';
import { PrismaService } from '../../database/prisma/prisma.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-aaa-111';
const TENANT_B = 'tenant-bbb-222';

// ─── Mock Factory ─────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    stockAlert: {
      count: jest.fn(),
    },
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── getDashboard ─────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    beforeEach(() => {
      // Default mocks for all parallel queries
      // Current period aggregate
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 5000 }, _count: { id: 20 } })
        // Previous period aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 4000 }, _count: { id: 15 } });
      // Orders today count
      prisma.order.count.mockResolvedValue(3);
      // Low stock alerts count
      prisma.stockAlert.count.mockResolvedValue(2);
      // Recent orders
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'order-001',
          orderNumber: 'PED-000001',
          status: 'CONFIRMED',
          totalAmount: 250,
          createdAt: new Date('2026-03-20'),
          customer: { name: 'John Doe' },
        },
      ]);
    });

    it('should return expected KPI structure', async () => {
      const result: DashboardData = await service.getDashboard(TENANT_A);

      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalOrders');
      expect(result).toHaveProperty('averageTicket');
      expect(result).toHaveProperty('ordersToday');
      expect(result).toHaveProperty('lowStockCount');
      expect(result).toHaveProperty('recentOrders');
      expect(result).toHaveProperty('variation');
      expect(result.variation).toHaveProperty('revenue');
      expect(result.variation).toHaveProperty('orders');
      expect(result.variation).toHaveProperty('averageTicket');
    });

    it('should calculate totalRevenue from current period aggregate', async () => {
      const result = await service.getDashboard(TENANT_A);

      expect(result.totalRevenue).toBe(5000);
    });

    it('should calculate totalOrders from current period aggregate', async () => {
      const result = await service.getDashboard(TENANT_A);

      expect(result.totalOrders).toBe(20);
    });

    it('should calculate averageTicket as totalRevenue / totalOrders', async () => {
      const result = await service.getDashboard(TENANT_A);

      expect(result.averageTicket).toBe(250); // 5000 / 20
    });

    it('should return ordersToday count', async () => {
      const result = await service.getDashboard(TENANT_A);

      expect(result.ordersToday).toBe(3);
    });

    it('should return lowStockCount', async () => {
      const result = await service.getDashboard(TENANT_A);

      expect(result.lowStockCount).toBe(2);
    });

    it('should return mapped recent orders with customerName', async () => {
      const result = await service.getDashboard(TENANT_A);

      expect(result.recentOrders).toHaveLength(1);
      expect(result.recentOrders[0]).toEqual({
        id: 'order-001',
        orderNumber: 'PED-000001',
        status: 'CONFIRMED',
        totalAmount: 250,
        customerName: 'John Doe',
        createdAt: expect.any(Date),
      });
    });

    it('should calculate revenue variation between periods', async () => {
      const result = await service.getDashboard(TENANT_A);

      // Current: 5000, Previous: 4000 -> (5000-4000)/4000 * 100 = 25%
      expect(result.variation.revenue).toBe(25);
    });

    it('should calculate orders variation between periods', async () => {
      const result = await service.getDashboard(TENANT_A);

      // Current: 20, Previous: 15 -> (20-15)/15 * 100 = 33.33%
      expect(result.variation.orders).toBe(33.33);
    });

    it('should handle zero previous period (100% variation when current > 0)', async () => {
      prisma.order.aggregate
        .mockReset()
        .mockResolvedValueOnce({ _sum: { totalAmount: 1000 }, _count: { id: 5 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: { id: 0 } });

      const result = await service.getDashboard(TENANT_A);

      expect(result.variation.revenue).toBe(100);
      expect(result.variation.orders).toBe(100);
    });

    it('should handle zero both periods (0% variation)', async () => {
      prisma.order.aggregate
        .mockReset()
        .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: { id: 0 } })
        .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: { id: 0 } });

      const result = await service.getDashboard(TENANT_A);

      expect(result.variation.revenue).toBe(0);
      expect(result.variation.orders).toBe(0);
      expect(result.averageTicket).toBe(0);
    });

    it('should scope all queries by tenantId', async () => {
      await service.getDashboard(TENANT_A);

      // Check aggregate calls include tenantId
      for (const call of prisma.order.aggregate.mock.calls) {
        expect(call[0].where.tenantId).toBe(TENANT_A);
      }
      // Check order count includes tenantId
      expect(prisma.order.count.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      // Check stockAlert count includes tenantId
      expect(prisma.stockAlert.count.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      // Check recent orders includes tenantId
      expect(prisma.order.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
    });

    it('should NOT return data from other tenants', async () => {
      await service.getDashboard(TENANT_A);

      for (const call of prisma.order.aggregate.mock.calls) {
        expect(call[0].where.tenantId).toBe(TENANT_A);
        expect(call[0].where.tenantId).not.toBe(TENANT_B);
      }
    });

    it('should exclude CANCELLED and DRAFT orders from revenue metrics', async () => {
      await service.getDashboard(TENANT_A);

      for (const call of prisma.order.aggregate.mock.calls) {
        expect(call[0].where.status).toEqual({ notIn: ['CANCELLED', 'DRAFT'] });
      }
    });

    it('should handle null customerName gracefully', async () => {
      prisma.order.findMany.mockReset().mockResolvedValue([
        {
          id: 'order-002',
          orderNumber: 'PED-000002',
          status: 'PENDING',
          totalAmount: 100,
          createdAt: new Date(),
          customer: null,
        },
      ]);

      const result = await service.getDashboard(TENANT_A);

      expect(result.recentOrders[0].customerName).toBeNull();
    });
  });
});

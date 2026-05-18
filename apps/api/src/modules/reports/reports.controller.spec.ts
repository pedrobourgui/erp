import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';

// ─── Mock ReportsService ─────────────────────────────────────────────────────

function createMockReportsService() {
  return {
    getDashboard: jest.fn(),
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';

function makeDashboardData() {
  return {
    totalOrders: 150,
    totalRevenue: 75000,
    pendingOrders: 12,
    lowStockProducts: 5,
    recentOrders: [
      { id: 'order-001', orderNumber: 'PED-000001', totalAmount: 500, status: 'CONFIRMED' },
    ],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReturnType<typeof createMockReportsService>;

  beforeEach(async () => {
    service = createMockReportsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: service },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getDashboard ─────────────────────────────────────────────────────
  describe('GET /reports/dashboard', () => {
    it('should return dashboard data wrapped in success response', async () => {
      const dashboardData = makeDashboardData();
      service.getDashboard.mockResolvedValue(dashboardData);

      const result = await controller.getDashboard(TENANT_ID);

      expect(service.getDashboard).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toEqual({ success: true, data: dashboardData });
    });

    it('should require reports:read permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.getDashboard);
      expect(metadata).toEqual(['reports:read']);
    });
  });
});

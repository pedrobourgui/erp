import { Test, TestingModule } from '@nestjs/testing';
import { StockEventsHandler } from './stock-events.handler';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StockLowEvent } from '../event-types';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    product: {
      findUnique: jest.fn(),
    },
    warehouse: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const PRODUCT_ID = 'prod-uuid-001';
const WAREHOUSE_ID = 'wh-uuid-001';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('StockEventsHandler', () => {
  let handler: StockEventsHandler;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockEventsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<StockEventsHandler>(StockEventsHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleStockLow', () => {
    const event = new StockLowEvent(TENANT_ID, PRODUCT_ID, null, WAREHOUSE_ID, 5, 20);

    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({ name: 'Widget A', sku: 'SKU-001' });
      prisma.warehouse.findUnique.mockResolvedValue({ name: 'Deposito Principal', code: 'DEP-001' });
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-001' },
        { id: 'user-002' },
      ]);
      prisma.notification.createMany.mockResolvedValue({ count: 2 });
      prisma.auditLog.create.mockResolvedValue({});
    });

    it('should fetch product and warehouse details', async () => {
      await handler.handleStockLow(event);

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        select: { name: true, sku: true },
      });
      expect(prisma.warehouse.findUnique).toHaveBeenCalledWith({
        where: { id: WAREHOUSE_ID },
        select: { name: true, code: true },
      });
    });

    it('should find admin/manager/warehouse users to notify', async () => {
      await handler.handleStockLow(event);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          status: 'ACTIVE',
          role: {
            name: { in: ['owner', 'admin', 'manager', 'warehouse'] },
          },
        },
        select: { id: true },
        take: 10,
      });
    });

    it('should create notifications for relevant users', async () => {
      await handler.handleStockLow(event);

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            tenantId: TENANT_ID,
            userId: 'user-001',
            type: 'IN_APP',
            priority: 'HIGH',
            title: 'Low stock alert',
            message: expect.stringContaining('Widget A (SKU-001)'),
          }),
          expect.objectContaining({
            userId: 'user-002',
          }),
        ]),
      });
    });

    it('should NOT create notifications when no relevant users exist', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await handler.handleStockLow(event);

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should create audit log entry', async () => {
      await handler.handleStockLow(event);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          entity: 'inventory_item',
          entityId: PRODUCT_ID,
          action: 'UPDATE',
          newData: expect.objectContaining({
            type: 'LOW_STOCK_ALERT',
            productId: PRODUCT_ID,
            warehouseId: WAREHOUSE_ID,
            currentQty: 5,
            minStock: 20,
          }),
        }),
      });
    });

    it('should use product ID as fallback label when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await handler.handleStockLow(event);

      const notificationData = prisma.notification.createMany.mock.calls[0][0].data[0];
      expect(notificationData.message).toContain(PRODUCT_ID);
    });

    it('should use warehouse ID as fallback label when warehouse not found', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);

      await handler.handleStockLow(event);

      const notificationData = prisma.notification.createMany.mock.calls[0][0].data[0];
      expect(notificationData.message).toContain(WAREHOUSE_ID);
    });

    it('should handle variantId in event data', async () => {
      const eventWithVariant = new StockLowEvent(TENANT_ID, PRODUCT_ID, 'var-001', WAREHOUSE_ID, 3, 10);

      await handler.handleStockLow(eventWithVariant);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          newData: expect.objectContaining({
            variantId: 'var-001',
          }),
        }),
      });
    });

    it('should not throw when an error occurs', async () => {
      prisma.product.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(handler.handleStockLow(event)).resolves.toBeUndefined();
    });
  });
});

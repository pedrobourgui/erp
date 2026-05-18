import { Test, TestingModule } from '@nestjs/testing';
import { OrderEventsHandler } from './order-events.handler';
import { PrismaService } from '../../database/prisma/prisma.service';
import { InventoryService } from '../../modules/inventory/inventory.service';
import {
  OrderCreatedEvent,
  OrderConfirmedEvent,
  OrderCancelledEvent,
} from '../event-types';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    order: {
      findUnique: jest.fn(),
    },
    accountsReceivable: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };
}

function createMockInventoryService() {
  return {
    reserveStock: jest.fn().mockResolvedValue(undefined),
    releaseStock: jest.fn().mockResolvedValue(undefined),
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const ORDER_ID = 'order-uuid-001';

const ITEMS = [
  { productId: 'prod-001', variantId: null, quantity: 2, unitPrice: 100, totalPrice: 200 },
  { productId: 'prod-002', variantId: 'var-001', quantity: 1, unitPrice: 50, totalPrice: 50 },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OrderEventsHandler', () => {
  let handler: OrderEventsHandler;
  let prisma: ReturnType<typeof createMockPrisma>;
  let inventoryService: ReturnType<typeof createMockInventoryService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    inventoryService = createMockInventoryService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderEventsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryService, useValue: inventoryService },
      ],
    }).compile();

    handler = module.get<OrderEventsHandler>(OrderEventsHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── handleOrderCreated ───────────────────────────────────────────────
  describe('handleOrderCreated', () => {
    it('should create a notification', async () => {
      prisma.notification.create.mockResolvedValue({});

      const event = new OrderCreatedEvent(ORDER_ID, TENANT_ID, USER_ID, ITEMS);
      await handler.handleOrderCreated(event);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          type: 'IN_APP',
          title: 'New order created',
          message: expect.stringContaining(ORDER_ID),
        }),
      });
    });

    it('should NOT reserve stock (stock is reserved on confirmation)', async () => {
      prisma.notification.create.mockResolvedValue({});

      const event = new OrderCreatedEvent(ORDER_ID, TENANT_ID, USER_ID, ITEMS);
      await handler.handleOrderCreated(event);

      expect(inventoryService.reserveStock).not.toHaveBeenCalled();
    });

    it('should not throw when notification creation fails', async () => {
      prisma.notification.create.mockRejectedValue(new Error('DB error'));

      const event = new OrderCreatedEvent(ORDER_ID, TENANT_ID, USER_ID, ITEMS);

      await expect(handler.handleOrderCreated(event)).resolves.toBeUndefined();
    });
  });

  // ─── handleOrderConfirmed ─────────────────────────────────────────────
  describe('handleOrderConfirmed', () => {
    const confirmedItems = [
      { productId: 'prod-001', variantId: null, quantity: 2 },
      { productId: 'prod-002', variantId: 'var-001', quantity: 1 },
    ];

    beforeEach(() => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        tenantId: TENANT_ID,
        customerId: 'cust-001',
        totalAmount: 250,
        orderNumber: 'PED-000001',
      });
      prisma.accountsReceivable.create.mockResolvedValue({});
      prisma.notification.create.mockResolvedValue({});
    });

    it('should reserve stock for each item', async () => {
      const event = new OrderConfirmedEvent(ORDER_ID, TENANT_ID, USER_ID, 250, confirmedItems);
      await handler.handleOrderConfirmed(event);

      expect(inventoryService.reserveStock).toHaveBeenCalledTimes(2);
      expect(inventoryService.reserveStock).toHaveBeenCalledWith(TENANT_ID, 'prod-001', null, 2);
      expect(inventoryService.reserveStock).toHaveBeenCalledWith(TENANT_ID, 'prod-002', 'var-001', 1);
    });

    it('should create accounts receivable with correct data', async () => {
      const event = new OrderConfirmedEvent(ORDER_ID, TENANT_ID, USER_ID, 250, confirmedItems);
      await handler.handleOrderConfirmed(event);

      expect(prisma.accountsReceivable.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          orderId: ORDER_ID,
          customerId: 'cust-001',
          amount: 250,
          status: 'PENDING',
          description: expect.stringContaining('PED-000001'),
          dueDate: expect.any(Date),
        }),
      });
    });

    it('should create a notification', async () => {
      const event = new OrderConfirmedEvent(ORDER_ID, TENANT_ID, USER_ID, 250, confirmedItems);
      await handler.handleOrderConfirmed(event);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          title: 'Order confirmed',
        }),
      });
    });

    it('should skip receivable creation when order is not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      const event = new OrderConfirmedEvent(ORDER_ID, TENANT_ID, USER_ID, 250, confirmedItems);
      await handler.handleOrderConfirmed(event);

      expect(inventoryService.reserveStock).toHaveBeenCalledTimes(2);
      expect(prisma.accountsReceivable.create).not.toHaveBeenCalled();
    });

    it('should not throw when an error occurs', async () => {
      inventoryService.reserveStock.mockRejectedValue(new Error('Stock error'));

      const event = new OrderConfirmedEvent(ORDER_ID, TENANT_ID, USER_ID, 250, confirmedItems);

      await expect(handler.handleOrderConfirmed(event)).resolves.toBeUndefined();
    });
  });

  // ─── handleOrderCancelled ─────────────────────────────────────────────
  describe('handleOrderCancelled', () => {
    const cancelledItems = [
      { productId: 'prod-001', variantId: null, quantity: 2 },
      { productId: 'prod-002', variantId: 'var-001', quantity: 1 },
    ];
    const reason = 'Customer requested cancellation';

    beforeEach(() => {
      prisma.accountsReceivable.updateMany.mockResolvedValue({ count: 1 });
      prisma.notification.create.mockResolvedValue({});
    });

    it('should release stock when previousStatus is post-confirmation (CONFIRMED)', async () => {
      const event = new OrderCancelledEvent(ORDER_ID, TENANT_ID, USER_ID, cancelledItems, reason, 'CONFIRMED');
      await handler.handleOrderCancelled(event);

      expect(inventoryService.releaseStock).toHaveBeenCalledTimes(2);
      expect(inventoryService.releaseStock).toHaveBeenCalledWith(TENANT_ID, 'prod-001', null, 2);
      expect(inventoryService.releaseStock).toHaveBeenCalledWith(TENANT_ID, 'prod-002', 'var-001', 1);
    });

    it('should release stock when previousStatus is PICKING', async () => {
      const event = new OrderCancelledEvent(ORDER_ID, TENANT_ID, USER_ID, cancelledItems, reason, 'PICKING');
      await handler.handleOrderCancelled(event);

      expect(inventoryService.releaseStock).toHaveBeenCalledTimes(2);
    });

    it('should NOT release stock when previousStatus is PENDING', async () => {
      const event = new OrderCancelledEvent(ORDER_ID, TENANT_ID, USER_ID, cancelledItems, reason, 'PENDING');
      await handler.handleOrderCancelled(event);

      expect(inventoryService.releaseStock).not.toHaveBeenCalled();
    });

    it('should NOT release stock when previousStatus is DRAFT', async () => {
      const event = new OrderCancelledEvent(ORDER_ID, TENANT_ID, USER_ID, cancelledItems, reason, 'DRAFT');
      await handler.handleOrderCancelled(event);

      expect(inventoryService.releaseStock).not.toHaveBeenCalled();
    });

    it('should NOT release stock when previousStatus is undefined', async () => {
      const event = new OrderCancelledEvent(ORDER_ID, TENANT_ID, USER_ID, cancelledItems, reason, undefined);
      await handler.handleOrderCancelled(event);

      expect(inventoryService.releaseStock).not.toHaveBeenCalled();
    });

    it('should cancel pending and partially paid receivables', async () => {
      const event = new OrderCancelledEvent(ORDER_ID, TENANT_ID, USER_ID, cancelledItems, reason, 'CONFIRMED');
      await handler.handleOrderCancelled(event);

      expect(prisma.accountsReceivable.updateMany).toHaveBeenCalledWith({
        where: {
          orderId: ORDER_ID,
          tenantId: TENANT_ID,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        data: { status: 'CANCELLED' },
      });
    });

    it('should create a notification with cancellation reason', async () => {
      const event = new OrderCancelledEvent(ORDER_ID, TENANT_ID, USER_ID, cancelledItems, reason, 'CONFIRMED');
      await handler.handleOrderCancelled(event);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          title: 'Order cancelled',
          message: expect.stringContaining(reason),
        }),
      });
    });

    it('should not throw when an error occurs', async () => {
      prisma.accountsReceivable.updateMany.mockRejectedValue(new Error('DB error'));

      const event = new OrderCancelledEvent(ORDER_ID, TENANT_ID, USER_ID, cancelledItems, reason, 'CONFIRMED');

      await expect(handler.handleOrderCancelled(event)).resolves.toBeUndefined();
    });
  });
});

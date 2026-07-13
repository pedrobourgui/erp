import { Test, TestingModule } from '@nestjs/testing';
import { OrderEventsHandler } from './order-events.handler';
import { PrismaService } from '../../database/prisma/prisma.service';
import { InventoryService } from '../../modules/inventory/inventory.service';
import {
  OrderCreatedEvent,
  OrderConfirmedEvent,
  OrderShippedEvent,
  OrderCancelledEvent,
  OrderCounterSaleEvent,
} from '../event-types';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockPrisma() {
  const tx = {
    financialAccount: {
      update: jest.fn().mockResolvedValue({ balance: 0 }),
    },
    financialTransaction: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    order: {
      findUnique: jest.fn(),
    },
    orderPayment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    financialTransaction: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    accountsReceivable: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    _tx: tx,
  };
}

function createMockInventoryService() {
  return {
    reserveStock: jest.fn().mockResolvedValue(undefined),
    releaseStock: jest.fn().mockResolvedValue(undefined),
    fulfillReservedStock: jest.fn().mockResolvedValue(undefined),
    deductStockForSale: jest.fn().mockResolvedValue(undefined),
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

    // ─── SCRUM-31: an order-based sale credits the account at creation ────
    describe('order-based sale (origin MANUAL) — account credit', () => {
      const cashPayment = {
        id: 'op-manual-1',
        amount: 250,
        installments: 1,
        financialAccountId: 'acc-1',
        paymentMethodId: 'pm-1',
        paymentMethod: { name: 'Dinheiro', type: 'CASH', defaultAccountId: null },
      };

      beforeEach(() => {
        prisma.notification.create.mockResolvedValue({});
        prisma.order.findUnique.mockResolvedValue({
          id: ORDER_ID,
          tenantId: TENANT_ID,
          orderNumber: 'PED-000001',
          origin: 'MANUAL',
        });
      });

      it('should credit the linked account for an immediate payment', async () => {
        prisma.orderPayment.findMany.mockResolvedValue([cashPayment]);
        prisma._tx.financialAccount.update.mockResolvedValue({ balance: 250 });

        await handler.handleOrderCreated(
          new OrderCreatedEvent(ORDER_ID, TENANT_ID, USER_ID, ITEMS),
        );

        expect(prisma._tx.financialAccount.update).toHaveBeenCalledWith({
          where: { id: 'acc-1' },
          data: { balance: { increment: 250 } },
          select: { balance: true },
        });
        const txArgs = prisma._tx.financialTransaction.create.mock.calls[0][0];
        expect(txArgs.data).toEqual(
          expect.objectContaining({
            accountId: 'acc-1',
            type: 'CREDIT',
            amount: 250,
            balanceAfter: 250,
            referenceType: 'order',
            referenceId: ORDER_ID,
            metadata: { orderPaymentId: 'op-manual-1' },
          }),
        );
      });

      it('should NOT credit twice when the event is replayed (idempotent)', async () => {
        prisma.orderPayment.findMany.mockResolvedValue([cashPayment]);
        // A transaction already exists for this order payment
        prisma.financialTransaction.findFirst.mockResolvedValue({ id: 'ft-existing' });

        await handler.handleOrderCreated(
          new OrderCreatedEvent(ORDER_ID, TENANT_ID, USER_ID, ITEMS),
        );

        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('should NOT credit a term payment (boleto) at creation', async () => {
        prisma.orderPayment.findMany.mockResolvedValue([
          {
            ...cashPayment,
            id: 'op-boleto',
            paymentMethod: { name: 'Boleto', type: 'BOLETO', defaultAccountId: 'acc-1' },
          },
        ]);

        await handler.handleOrderCreated(
          new OrderCreatedEvent(ORDER_ID, TENANT_ID, USER_ID, ITEMS),
        );

        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('should NOT credit for external origins (marketplace)', async () => {
        prisma.order.findUnique.mockResolvedValue({
          id: ORDER_ID,
          tenantId: TENANT_ID,
          orderNumber: 'PED-000001',
          origin: 'SHOPEE',
        });
        prisma.orderPayment.findMany.mockResolvedValue([cashPayment]);

        await handler.handleOrderCreated(
          new OrderCreatedEvent(ORDER_ID, TENANT_ID, USER_ID, ITEMS),
        );

        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
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

    // SCRUM-31: cash on an order-based sale is settled at the sale, so its
    // receivable must not linger as PENDING (it was already credited).
    it('should mark the receivable of an immediate payment as PAID', async () => {
      prisma.orderPayment.findMany.mockResolvedValue([
        {
          id: 'op-1',
          amount: 250,
          installments: 1,
          financialAccountId: 'acc-1',
          paymentMethodId: 'pm-1',
          paymentMethod: { id: 'pm-1', name: 'Dinheiro', type: 'CASH' },
          paymentCondition: null,
        },
      ]);

      await handler.handleOrderConfirmed(
        new OrderConfirmedEvent(ORDER_ID, TENANT_ID, USER_ID, 250, confirmedItems),
      );

      const data = prisma.accountsReceivable.create.mock.calls[0][0].data;
      expect(data.status).toBe('PAID');
      expect(data.paidAmount).toBe(250);
      expect(data.paidAt).toBeInstanceOf(Date);
    });

    it('should keep the receivable of a term payment PENDING', async () => {
      prisma.orderPayment.findMany.mockResolvedValue([
        {
          id: 'op-2',
          amount: 250,
          installments: 1,
          financialAccountId: null,
          paymentMethodId: 'pm-2',
          paymentMethod: { id: 'pm-2', name: 'Boleto', type: 'BOLETO' },
          paymentCondition: null,
        },
      ]);

      await handler.handleOrderConfirmed(
        new OrderConfirmedEvent(ORDER_ID, TENANT_ID, USER_ID, 250, confirmedItems),
      );

      const data = prisma.accountsReceivable.create.mock.calls[0][0].data;
      expect(data.status).toBe('PENDING');
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

  // ─── handleOrderShipped ───────────────────────────────────────────────
  describe('handleOrderShipped', () => {
    const shippedItems = [
      { productId: 'prod-001', variantId: null, quantity: 2 },
      { productId: 'prod-002', variantId: 'var-001', quantity: 1 },
    ];

    it('should deduct reserved stock for each item on shipment', async () => {
      const event = new OrderShippedEvent(ORDER_ID, TENANT_ID, USER_ID, shippedItems);
      await handler.handleOrderShipped(event);

      expect(inventoryService.fulfillReservedStock).toHaveBeenCalledTimes(2);
      expect(inventoryService.fulfillReservedStock).toHaveBeenCalledWith(TENANT_ID, 'prod-001', null, 2, ORDER_ID);
      expect(inventoryService.fulfillReservedStock).toHaveBeenCalledWith(TENANT_ID, 'prod-002', 'var-001', 1, ORDER_ID);
    });

    it('should NOT reserve stock again on shipment', async () => {
      const event = new OrderShippedEvent(ORDER_ID, TENANT_ID, USER_ID, shippedItems);
      await handler.handleOrderShipped(event);

      expect(inventoryService.reserveStock).not.toHaveBeenCalled();
    });

    it('should not throw when stock deduction fails', async () => {
      inventoryService.fulfillReservedStock.mockRejectedValue(new Error('Stock error'));

      const event = new OrderShippedEvent(ORDER_ID, TENANT_ID, USER_ID, shippedItems);

      await expect(handler.handleOrderShipped(event)).resolves.toBeUndefined();
    });
  });

  // ─── handleOrderCounterSale (balance credit) ──────────────────────────
  describe('handleOrderCounterSale', () => {
    const counterItems = [
      { productId: 'prod-001', variantId: null, quantity: 1 },
    ];

    beforeEach(() => {
      prisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        tenantId: TENANT_ID,
        customerId: 'cust-001',
        totalAmount: 100,
        orderNumber: 'PED-000001',
      });
      prisma.accountsReceivable.create.mockResolvedValue({});
      prisma.notification.create.mockResolvedValue({});
    });

    it('should credit the linked account and record a CREDIT transaction for an immediate payment', async () => {
      prisma.orderPayment.findMany.mockResolvedValue([
        {
          id: 'op-1',
          amount: 100,
          installments: 1,
          financialAccountId: 'acc-1',
          paymentMethodId: 'pm-1',
          paymentMethod: { name: 'Dinheiro', type: 'CASH', defaultAccountId: 'acc-def' },
        },
      ]);
      prisma._tx.financialAccount.update.mockResolvedValue({ balance: 350 });

      const event = new OrderCounterSaleEvent(ORDER_ID, TENANT_ID, USER_ID, 100, counterItems);
      await handler.handleOrderCounterSale(event);

      expect(prisma._tx.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 100 } },
        select: { balance: true },
      });
      const txArgs = prisma._tx.financialTransaction.create.mock.calls[0][0];
      expect(txArgs.data).toEqual(
        expect.objectContaining({
          tenantId: TENANT_ID,
          accountId: 'acc-1',
          type: 'CREDIT',
          amount: 100,
          balanceAfter: 350,
          referenceType: 'order',
          referenceId: ORDER_ID,
        }),
      );
    });

    it('should fall back to the payment method default account when the payment has none', async () => {
      prisma.orderPayment.findMany.mockResolvedValue([
        {
          id: 'op-2',
          amount: 50,
          installments: 1,
          financialAccountId: null,
          paymentMethodId: 'pm-1',
          paymentMethod: { name: 'PIX', type: 'PIX', defaultAccountId: 'acc-def' },
        },
      ]);

      const event = new OrderCounterSaleEvent(ORDER_ID, TENANT_ID, USER_ID, 50, counterItems);
      await handler.handleOrderCounterSale(event);

      expect(prisma._tx.financialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'acc-def' } }),
      );
    });

    it('should skip crediting when no account can be resolved', async () => {
      prisma.orderPayment.findMany.mockResolvedValue([
        {
          id: 'op-3',
          amount: 50,
          installments: 1,
          financialAccountId: null,
          paymentMethodId: 'pm-1',
          paymentMethod: { name: 'PIX', type: 'PIX', defaultAccountId: null },
        },
      ]);

      const event = new OrderCounterSaleEvent(ORDER_ID, TENANT_ID, USER_ID, 50, counterItems);
      await handler.handleOrderCounterSale(event);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should NOT credit for non-immediate payment types (e.g. BOLETO)', async () => {
      prisma.orderPayment.findMany.mockResolvedValue([
        {
          id: 'op-4',
          amount: 50,
          installments: 1,
          financialAccountId: 'acc-1',
          paymentMethodId: 'pm-1',
          paymentMethod: { name: 'Boleto', type: 'BOLETO', defaultAccountId: 'acc-1' },
        },
      ]);

      const event = new OrderCounterSaleEvent(ORDER_ID, TENANT_ID, USER_ID, 50, counterItems);
      await handler.handleOrderCounterSale(event);

      expect(prisma.$transaction).not.toHaveBeenCalled();
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

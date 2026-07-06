import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  OrderCreatedEvent,
  OrderConfirmedEvent,
  OrderShippedEvent,
  OrderCancelledEvent,
} from '../../events/event-types';

// ─── Shared Fixtures ────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-999';
const USER_ID = 'user-uuid-001';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-uuid-001',
    tenantId: TENANT_ID,
    orderNumber: 'PED-000001',
    status: 'PENDING',
    origin: 'MANUAL',
    customerId: 'cust-uuid-001',
    sellerId: USER_ID,
    subtotal: 200,
    discount: 0,
    shippingCost: 15,
    totalAmount: 215,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    deletedAt: null,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    items: [
      {
        id: 'item-uuid-001',
        productId: 'prod-uuid-001',
        variantId: null,
        sku: 'SKU-001',
        name: 'Widget A',
        quantity: 2,
        unitPrice: 100,
        discount: 0,
        totalPrice: 200,
      },
    ],
    customer: { id: 'cust-uuid-001', name: 'John Doe' },
    statusHistory: [
      {
        id: 'hist-uuid-001',
        orderId: 'order-uuid-001',
        fromStatus: null,
        toStatus: 'PENDING',
        notes: 'Order created',
        changedBy: USER_ID,
        createdAt: new Date('2026-03-01'),
      },
    ],
    ...overrides,
  };
}

function makeProduct(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sku: `SKU-${id}`,
    name: `Product ${id}`,
    salePrice: 100,
    ...overrides,
  };
}

// ─── Mock Factories ─────────────────────────────────────────────────────────

function createMockPrisma() {
  const prisma = {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    inventoryItem: {
      findFirst: jest.fn(),
    },
    cashRegisterSession: {
      findFirst: jest.fn(),
    },
    orderStatusHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  // By default, $transaction executes the callback with prisma itself as the tx client
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  return prisma;
}

function createMockEventEmitter() {
  return {
    emit: jest.fn(),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    eventEmitter = createMockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const paginatedOrders = [makeOrder()];
    const total = 1;

    beforeEach(() => {
      prisma.order.findMany.mockResolvedValue(paginatedOrders);
      prisma.order.count.mockResolvedValue(total);
    });

    it('should return paginated orders for tenant', async () => {
      const result = await service.findAll(TENANT_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual(paginatedOrders);
      expect(result.meta.total).toBe(total);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);

      // Verify tenantId is always in the where clause
      const whereArg = prisma.order.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_ID);
      expect(whereArg.deletedAt).toBeNull();
    });

    it('should filter by status', async () => {
      await service.findAll(TENANT_ID, { status: 'CONFIRMED' });

      const whereArg = prisma.order.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe('CONFIRMED');
    });

    it('should filter by origin', async () => {
      await service.findAll(TENANT_ID, { origin: 'SHOPEE' });

      const whereArg = prisma.order.findMany.mock.calls[0][0].where;
      expect(whereArg.origin).toBe('SHOPEE');
    });

    it('should filter by customerId', async () => {
      const customerId = 'cust-uuid-001';
      await service.findAll(TENANT_ID, { customerId });

      const whereArg = prisma.order.findMany.mock.calls[0][0].where;
      expect(whereArg.customerId).toBe(customerId);
    });

    it('should filter by date range (dateFrom/dateTo)', async () => {
      const dateFrom = '2026-01-01';
      const dateTo = '2026-03-31';
      await service.findAll(TENANT_ID, { dateFrom, dateTo });

      const whereArg = prisma.order.findMany.mock.calls[0][0].where;
      expect(whereArg.createdAt.gte).toEqual(new Date(dateFrom));
      expect(whereArg.createdAt.lte).toEqual(new Date(dateTo));
    });

    it('should search by order number', async () => {
      await service.findAll(TENANT_ID, { search: 'PED-000001' });

      const whereArg = prisma.order.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            orderNumber: { contains: 'PED-000001', mode: 'insensitive' },
          }),
        ]),
      );
    });

    it('should NOT return orders from other tenants', async () => {
      await service.findAll(TENANT_ID, {});

      const whereArg = prisma.order.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_ID);
      expect(whereArg.tenantId).not.toBe(OTHER_TENANT_ID);
    });

    it('should include customer info and items count', async () => {
      await service.findAll(TENANT_ID, {});

      const includeArg = prisma.order.findMany.mock.calls[0][0].include;
      expect(includeArg.customer).toBeDefined();
      expect(includeArg._count).toEqual({ select: { items: true } });
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return order with items, customer, status history', async () => {
      const order = makeOrder();
      prisma.order.findFirst.mockResolvedValue(order);

      const result = await service.findOne(TENANT_ID, 'order-uuid-001');

      expect(result).toEqual(order);
      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-uuid-001', tenantId: TENANT_ID, deletedAt: null },
          include: expect.objectContaining({
            customer: true,
            items: expect.anything(),
            statusHistory: expect.anything(),
          }),
        }),
      );
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when order belongs to another tenant', async () => {
      // The query scopes by tenantId, so a mismatch returns null
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_TENANT_ID, 'order-uuid-001'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: OTHER_TENANT_ID }),
        }),
      );
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      customerId: 'cust-uuid-001',
      items: [
        { productId: 'prod-uuid-001', quantity: 2, unitPrice: 100 },
        { productId: 'prod-uuid-002', quantity: 1, unitPrice: 50, discount: 5 },
      ],
      discount: 10,
      shippingCost: 15,
    };

    const products = [
      makeProduct('prod-uuid-001'),
      makeProduct('prod-uuid-002', { sku: 'SKU-002', name: 'Product 2', salePrice: 50 }),
    ];

    beforeEach(() => {
      prisma.product.findMany.mockResolvedValue(products);
      // For generateOrderNumber - no existing orders
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.order.create.mockImplementation(async ({ data, include }: Record<string, unknown>) => ({
        id: 'order-uuid-new',
        tenantId: TENANT_ID,
        orderNumber: 'PED-000001',
        status: 'PENDING',
        ...(data as Record<string, unknown>),
        items: (data as Record<string, unknown> & { items: { create: unknown[] } }).items.create,
        customer: { id: 'cust-uuid-001', name: 'John Doe' },
        statusHistory: [
          {
            fromStatus: null,
            toStatus: 'PENDING',
            notes: 'Order created',
            changedBy: USER_ID,
          },
        ],
      }));
    });

    it('should create order with items and calculate totals correctly', async () => {
      const result = await service.create(TENANT_ID, USER_ID, createDto as any);

      const createCall = prisma.order.create.mock.calls[0][0];
      const data = createCall.data;

      // item1: 2 * 100 - 0 = 200
      // item2: 1 * 50 - 5 = 45
      // subtotal = 245
      // totalAmount = 245 - 10 + 15 = 250
      expect(data.subtotal).toBe(245);
      expect(data.discount).toBe(10);
      expect(data.shippingCost).toBe(15);
      expect(data.totalAmount).toBe(250);
    });

    it('should auto-generate sequential order number (PED-XXXXXX)', async () => {
      prisma.order.findFirst.mockResolvedValue(null);
      await service.create(TENANT_ID, USER_ID, createDto as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.orderNumber).toBe('PED-000001');
    });

    it('should increment order number based on last existing order', async () => {
      // First call inside $transaction is the create; the generateOrderNumber call is separate
      // We need findFirst to return last order for generateOrderNumber, then null for subsequent calls
      prisma.order.findFirst.mockResolvedValueOnce({ orderNumber: 'PED-000042' });
      prisma.order.create.mockResolvedValue(makeOrder({ orderNumber: 'PED-000043' }));

      await service.create(TENANT_ID, USER_ID, createDto as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.orderNumber).toBe('PED-000043');
    });

    it('should set initial status to PENDING', async () => {
      await service.create(TENANT_ID, USER_ID, createDto as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.status).toBe('PENDING');
    });

    it('should validate all product IDs exist', async () => {
      await service.create(TENANT_ID, USER_ID, createDto as any);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: ['prod-uuid-001', 'prod-uuid-002'] },
            tenantId: TENANT_ID,
            deletedAt: null,
          },
        }),
      );
    });

    it('should throw BadRequestException when product not found', async () => {
      // Only return one of the two products
      prisma.product.findMany.mockResolvedValue([products[0]]);

      await expect(
        service.create(TENANT_ID, USER_ID, createDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with the missing product IDs', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await expect(
        service.create(TENANT_ID, USER_ID, createDto as any),
      ).rejects.toThrow(/prod-uuid-001/);
    });

    it('should calculate item.totalPrice = quantity * unitPrice - discount', async () => {
      await service.create(TENANT_ID, USER_ID, createDto as any);

      const itemsCreated = prisma.order.create.mock.calls[0][0].data.items.create;
      // Item 1: 2 * 100 - 0 = 200
      expect(itemsCreated[0].totalPrice).toBe(200);
      // Item 2: 1 * 50 - 5 = 45
      expect(itemsCreated[1].totalPrice).toBe(45);
    });

    it('should calculate order.subtotal = sum of item totals', async () => {
      await service.create(TENANT_ID, USER_ID, createDto as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.subtotal).toBe(200 + 45); // 245
    });

    it('should calculate order.totalAmount = subtotal - discount + shippingCost', async () => {
      await service.create(TENANT_ID, USER_ID, createDto as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.totalAmount).toBe(245 - 10 + 15); // 250
    });

    it('should floor totalPrice to zero when discount exceeds line total', async () => {
      const dtoWithBigDiscount = {
        customerId: 'cust-uuid-001',
        items: [
          { productId: 'prod-uuid-001', quantity: 1, unitPrice: 10, discount: 999 },
        ],
      };
      prisma.product.findMany.mockResolvedValue([products[0]]);
      prisma.order.findFirst.mockResolvedValue(null);

      await service.create(TENANT_ID, USER_ID, dtoWithBigDiscount as any);

      const itemsCreated = prisma.order.create.mock.calls[0][0].data.items.create;
      expect(itemsCreated[0].totalPrice).toBe(0);
    });

    it('should emit ORDER_CREATED event', async () => {
      await service.create(TENANT_ID, USER_ID, createDto as any);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.created',
        expect.any(OrderCreatedEvent),
      );
    });

    it('should create OrderStatusHistory record', async () => {
      await service.create(TENANT_ID, USER_ID, createDto as any);

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.statusHistory.create).toEqual(
        expect.objectContaining({
          fromStatus: null,
          toStatus: 'PENDING',
          notes: 'Order created',
          changedBy: USER_ID,
        }),
      );
    });

    // ─── counter sale (BALCAO) requires an open cash register ─────────────
    describe('counter sale (origin BALCAO)', () => {
      const counterSaleDto = {
        ...createDto,
        origin: 'BALCAO',
      };

      it('should throw ConflictException when there is no open cash register', async () => {
        prisma.cashRegisterSession.findFirst.mockResolvedValue(null);

        await expect(
          service.create(TENANT_ID, USER_ID, counterSaleDto as any),
        ).rejects.toThrow(ConflictException);

        // Must not create the order when the cash register is closed
        expect(prisma.order.create).not.toHaveBeenCalled();
      });

      it('should look up the open session scoped by tenant and status OPEN', async () => {
        prisma.cashRegisterSession.findFirst.mockResolvedValue(null);

        await expect(
          service.create(TENANT_ID, USER_ID, counterSaleDto as any),
        ).rejects.toThrow(ConflictException);

        const whereArg = prisma.cashRegisterSession.findFirst.mock.calls[0][0].where;
        expect(whereArg.tenantId).toBe(TENANT_ID);
        expect(whereArg.status).toBe('OPEN');
      });

      it('should create the counter sale when a cash register is open', async () => {
        prisma.cashRegisterSession.findFirst.mockResolvedValue({ id: 'session-uuid-001' });
        // stock available for both items so validateStockForConfirmation passes
        prisma.inventoryItem.findFirst.mockResolvedValue({
          id: 'ii-001',
          available: 999,
          product: { name: 'Widget A', sku: 'SKU-001' },
        });

        await service.create(TENANT_ID, USER_ID, counterSaleDto as any);

        expect(prisma.order.create).toHaveBeenCalled();
        const data = prisma.order.create.mock.calls[0][0].data;
        expect(data.status).toBe('COMPLETED');
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'order.counter_sale',
          expect.anything(),
        );
      });
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────

  describe('updateStatus', () => {
    function orderWithStatus(status: string) {
      return makeOrder({ status, items: makeOrder().items });
    }

    beforeEach(() => {
      prisma.order.update.mockImplementation(async ({ data }: Record<string, unknown>) => ({
        ...makeOrder(),
        ...(data as Record<string, unknown>),
      }));
      prisma.orderStatusHistory.create.mockResolvedValue({});
      // Mock inventoryItem for stock validation on CONFIRMED transitions
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'ii-001',
        available: 999,
        product: { name: 'Widget A', sku: 'SKU-001' },
      });
    });

    it.each([
      ['PENDING', 'CONFIRMED'],
      ['CONFIRMED', 'PICKING'],
      ['PICKING', 'PACKED'],
      ['PACKED', 'SHIPPED'],
      ['SHIPPED', 'DELIVERED'],
      ['DELIVERED', 'COMPLETED'],
    ])(
      'should transition from %s to %s',
      async (from, to) => {
        prisma.order.findFirst.mockResolvedValue(orderWithStatus(from));

        await service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
          status: to,
        });

        expect(prisma.order.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: to }),
          }),
        );
      },
    );

    it('should throw BadRequestException for invalid transition PENDING -> SHIPPED', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('PENDING'));

      await expect(
        service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
          status: 'SHIPPED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid transition COMPLETED -> PENDING', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('COMPLETED'));

      await expect(
        service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
          status: 'PENDING',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for transition from terminal CANCELLED status', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('CANCELLED'));

      await expect(
        service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
          status: 'PENDING',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set shippedAt when transitioning to SHIPPED', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('PACKED'));

      await service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
        status: 'SHIPPED',
      });

      const updateData = prisma.order.update.mock.calls[0][0].data;
      expect(updateData.shippedAt).toBeInstanceOf(Date);
    });

    it('should set deliveredAt when transitioning to DELIVERED', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('SHIPPED'));

      await service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
        status: 'DELIVERED',
      });

      const updateData = prisma.order.update.mock.calls[0][0].data;
      expect(updateData.deliveredAt).toBeInstanceOf(Date);
    });

    it('should NOT set shippedAt/deliveredAt for other transitions', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('PENDING'));

      await service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
        status: 'CONFIRMED',
      });

      const updateData = prisma.order.update.mock.calls[0][0].data;
      expect(updateData.shippedAt).toBeUndefined();
      expect(updateData.deliveredAt).toBeUndefined();
    });

    it('should emit order.confirmed event when transitioning to CONFIRMED', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('PENDING'));

      await service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
        status: 'CONFIRMED',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.confirmed',
        expect.any(OrderConfirmedEvent),
      );
    });

    it('should emit order.shipped event when transitioning to SHIPPED', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('PACKED'));

      await service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
        status: 'SHIPPED',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.shipped',
        expect.any(OrderShippedEvent),
      );
    });

    it('should NOT emit confirmed/shipped events for other transitions', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('CONFIRMED'));

      await service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
        status: 'PICKING',
      });

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'order.confirmed',
        expect.anything(),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'order.shipped',
        expect.anything(),
      );
    });

    it('should create OrderStatusHistory record with user and notes', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWithStatus('PENDING'));

      await service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, {
        status: 'CONFIRMED',
        notes: 'Payment verified',
      });

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-uuid-001',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          notes: 'Payment verified',
          changedBy: USER_ID,
        }),
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(TENANT_ID, 'nonexistent', USER_ID, {
          status: 'CONFIRMED',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── cancel ─────────────────────────────────────────────────────────────

  describe('cancel', () => {
    const cancelDto = { reason: 'Customer requested cancellation' };

    beforeEach(() => {
      prisma.order.update.mockImplementation(async ({ data }: Record<string, unknown>) => ({
        ...makeOrder(),
        status: 'CANCELLED',
        ...(data as Record<string, unknown>),
      }));
      prisma.orderStatusHistory.create.mockResolvedValue({});
    });

    it('should cancel order from PENDING status', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PENDING' }));

      const result = await service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto);

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelReason: cancelDto.reason,
          }),
        }),
      );
    });

    it('should cancel order from CONFIRMED status', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'CONFIRMED' }));

      await service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto);

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('should cancel order from PICKING status', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PICKING' }));

      await service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto);

      expect(prisma.order.update).toHaveBeenCalled();
    });

    it('should NOT allow cancel from COMPLETED status', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'COMPLETED' }));

      await expect(
        service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should NOT allow cancel from already CANCELLED status', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'CANCELLED' }));

      await expect(
        service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should NOT allow cancel from SHIPPED status', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'SHIPPED' }));

      await expect(
        service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should NOT allow cancel from DELIVERED status', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'DELIVERED' }));

      await expect(
        service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set cancelledAt and cancelReason', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PENDING' }));

      await service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto);

      const updateData = prisma.order.update.mock.calls[0][0].data;
      expect(updateData.cancelledAt).toBeInstanceOf(Date);
      expect(updateData.cancelReason).toBe(cancelDto.reason);
    });

    it('should emit ORDER_CANCELLED event', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PENDING' }));

      await service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.cancelled',
        expect.any(OrderCancelledEvent),
      );
    });

    it('should pass items and reason in the ORDER_CANCELLED event', async () => {
      const order = makeOrder({ status: 'PENDING' });
      prisma.order.findFirst.mockResolvedValue(order);

      await service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto);

      const emittedEvent = eventEmitter.emit.mock.calls[0][1] as OrderCancelledEvent;
      expect(emittedEvent.items).toEqual(order.items);
      expect(emittedEvent.reason).toBe(cancelDto.reason);
    });

    it('should create status history record', async () => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PENDING' }));

      await service.cancel(TENANT_ID, 'order-uuid-001', USER_ID, cancelDto);

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-uuid-001',
          fromStatus: 'PENDING',
          toStatus: 'CANCELLED',
          notes: cancelDto.reason,
          changedBy: USER_ID,
        }),
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel(TENANT_ID, 'nonexistent', USER_ID, cancelDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getTimeline ────────────────────────────────────────────────────────

  describe('getTimeline', () => {
    it('should return status history ordered by date ascending', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-uuid-001' });
      const history = [
        { id: 'h1', toStatus: 'PENDING', createdAt: new Date('2026-03-01') },
        { id: 'h2', toStatus: 'CONFIRMED', createdAt: new Date('2026-03-02') },
        { id: 'h3', toStatus: 'SHIPPED', createdAt: new Date('2026-03-05') },
      ];
      prisma.orderStatusHistory.findMany.mockResolvedValue(history);

      const result = await service.getTimeline(TENANT_ID, 'order-uuid-001');

      expect(result).toEqual(history);
      expect(prisma.orderStatusHistory.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-uuid-001' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.getTimeline(TENANT_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should scope the order lookup to the tenant', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await service.getTimeline(TENANT_ID, 'order-uuid-001').catch(() => {});

      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-uuid-001', tenantId: TENANT_ID, deletedAt: null },
        select: { id: true },
      });
    });
  });

  // ─── ORDER_STATUS_TRANSITIONS enforcement ──────────────────────────────

  describe('ORDER_STATUS_TRANSITIONS state machine', () => {
    beforeEach(() => {
      prisma.order.update.mockResolvedValue(makeOrder());
      prisma.orderStatusHistory.create.mockResolvedValue({});
      // Mock inventoryItem for stock validation on CONFIRMED transitions
      prisma.inventoryItem.findFirst.mockResolvedValue({
        id: 'ii-001',
        available: 999,
        product: { name: 'Widget A', sku: 'SKU-001' },
      });
    });

    const validTransitions: [string, string][] = [
      ['DRAFT', 'PENDING'],
      ['DRAFT', 'CANCELLED'],
      ['PENDING', 'CONFIRMED'],
      ['PENDING', 'CANCELLED'],
      ['CONFIRMED', 'PICKING'],
      ['CONFIRMED', 'CANCELLED'],
      ['PICKING', 'PACKED'],
      ['PICKING', 'CANCELLED'],
      ['PACKED', 'SHIPPED'],
      ['PACKED', 'CANCELLED'],
      ['SHIPPED', 'DELIVERED'],
      ['DELIVERED', 'COMPLETED'],
      ['DELIVERED', 'RETURNED'],
    ];

    const invalidTransitions: [string, string][] = [
      ['PENDING', 'SHIPPED'],
      ['PENDING', 'DELIVERED'],
      ['PENDING', 'COMPLETED'],
      ['CONFIRMED', 'SHIPPED'],
      ['CONFIRMED', 'DELIVERED'],
      ['SHIPPED', 'CONFIRMED'],
      ['SHIPPED', 'PENDING'],
      ['SHIPPED', 'CANCELLED'],
      ['COMPLETED', 'PENDING'],
      ['COMPLETED', 'CONFIRMED'],
      ['COMPLETED', 'CANCELLED'],
      ['CANCELLED', 'PENDING'],
      ['CANCELLED', 'CONFIRMED'],
      ['RETURNED', 'PENDING'],
    ];

    it.each(validTransitions)(
      'should allow transition %s -> %s',
      async (from, to) => {
        prisma.order.findFirst.mockResolvedValue(makeOrder({ status: from }));

        await expect(
          service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, { status: to }),
        ).resolves.toBeDefined();
      },
    );

    it.each(invalidTransitions)(
      'should reject transition %s -> %s',
      async (from, to) => {
        prisma.order.findFirst.mockResolvedValue(makeOrder({ status: from }));

        await expect(
          service.updateStatus(TENANT_ID, 'order-uuid-001', USER_ID, { status: to }),
        ).rejects.toThrow(BadRequestException);
      },
    );
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ReverseSaleUseCase } from './reverse-sale.use-case';

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-999';
const USER_ID = 'user-uuid-001';
const ORDER_ID = 'order-uuid-001';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    tenantId: TENANT_ID,
    orderNumber: 'PED-000010',
    status: 'COMPLETED',
    origin: 'BALCAO',
    customerId: 'cust-001',
    totalAmount: 199.8,
    cashRegisterSessionId: 'session-001',
    deletedAt: null,
    items: [
      {
        id: 'item-001',
        productId: 'prod-001',
        variantId: null,
        name: 'Widget A',
        quantity: 2,
        totalPrice: 199.8,
      },
    ],
    ...overrides,
  };
}

function createMockPrisma() {
  const prisma = {
    order: {
      findFirst: jest.fn().mockResolvedValue(makeOrder()),
      update: jest.fn().mockResolvedValue(makeOrder({ status: 'RETURNED' })),
    },
    warehouse: {
      findFirst: jest.fn().mockResolvedValue({ id: 'wh-001' }),
    },
    inventoryItem: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ii-001' }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    inventoryMovement: {
      create: jest.fn().mockResolvedValue({}),
    },
    accountsReceivable: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    accountsPayable: {
      create: jest.fn().mockResolvedValue({ id: 'ap-001' }),
    },
    cashRegisterSession: {
      findFirst: jest.fn().mockResolvedValue({ id: 'session-001', status: 'OPEN' }),
    },
    cashRegisterMovement: {
      create: jest.fn().mockResolvedValue({}),
    },
    orderStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  return prisma;
}

describe('ReverseSaleUseCase', () => {
  let useCase: ReverseSaleUseCase;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReverseSaleUseCase, { provide: PrismaService, useValue: prisma }],
    }).compile();

    useCase = module.get(ReverseSaleUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  const reason = { reason: 'Cliente desistiu da compra' };

  // ─── Eligibility ────────────────────────────────────────────────────

  it('should throw NotFoundException when the order does not exist', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason),
    ).rejects.toThrow(NotFoundException);
  });

  it('should scope the lookup by tenant', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(OTHER_TENANT_ID, ORDER_ID, USER_ID, reason),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: OTHER_TENANT_ID }),
      }),
    );
  });

  it('should reverse a completed counter sale', async () => {
    await expect(
      useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason),
    ).resolves.toMatchObject({ orderId: ORDER_ID, status: 'RETURNED' });
  });

  it('should accept a delivered order as a customer return', async () => {
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ status: 'DELIVERED', origin: 'MANUAL', cashRegisterSessionId: null }),
    );

    await expect(
      useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason),
    ).resolves.toMatchObject({ status: 'RETURNED' });
  });

  it.each(['PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED'])(
    'should refuse to reverse an order still in %s',
    async (status) => {
      prisma.order.findFirst.mockResolvedValue(makeOrder({ status, origin: 'MANUAL' }));

      await expect(
        useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason),
      ).rejects.toThrow(BadRequestException);
    },
  );

  // No double reversal: RETURNED is terminal.
  it('should refuse to reverse an already returned order', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'RETURNED' }));

    await expect(
      useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason),
    ).rejects.toThrow(BadRequestException);
  });

  it('should require a reason', async () => {
    await expect(
      useCase.execute(TENANT_ID, ORDER_ID, USER_ID, { reason: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  // Time policy: a counter sale can only be reversed while its cash session is open.
  it('should refuse a counter sale whose cash session is already closed', async () => {
    prisma.cashRegisterSession.findFirst.mockResolvedValue({
      id: 'session-001',
      status: 'CLOSED',
    });

    await expect(
      useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Stock ──────────────────────────────────────────────────────────

  it('should return the sold units to stock', async () => {
    await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: { increment: 2 }, available: { increment: 2 } },
      }),
    );
  });

  it('should record a RETURN movement for the audit trail', async () => {
    await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        productId: 'prod-001',
        type: 'RETURN',
        reason: 'RETURN_CUSTOMER',
        quantity: 2,
        referenceId: ORDER_ID,
        userId: USER_ID,
      }),
    });
  });

  it('should create the inventory row when the product has none in the warehouse', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue(null);

    await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productId: 'prod-001', quantity: 2, available: 2 }),
      }),
    );
  });

  // ─── Financials ─────────────────────────────────────────────────────

  it('should cancel the receivables that were still open', async () => {
    await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.accountsReceivable.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: ORDER_ID,
        tenantId: TENANT_ID,
        status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      data: { status: 'CANCELLED' },
    });
  });

  it('should raise a payable for what the customer had already paid', async () => {
    prisma.accountsReceivable.findMany.mockResolvedValue([
      { id: 'ar-1', paidAmount: 100, amount: 100, status: 'PAID' },
      { id: 'ar-2', paidAmount: 99.8, amount: 99.8, status: 'PAID' },
    ]);

    const result = await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.accountsPayable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_ID, amount: 199.8 }),
      }),
    );
    expect(result.refundedAmount).toBe(199.8);
  });

  it('should not raise a payable when nothing had been paid', async () => {
    prisma.accountsReceivable.findMany.mockResolvedValue([]);

    const result = await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.accountsPayable.create).not.toHaveBeenCalled();
    expect(result.refundedAmount).toBe(0);
  });

  // ─── Cash register ──────────────────────────────────────────────────

  it('should withdraw the refunded amount from the open session', async () => {
    prisma.accountsReceivable.findMany.mockResolvedValue([
      { id: 'ar-1', paidAmount: 199.8, amount: 199.8, status: 'PAID' },
    ]);

    await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.cashRegisterMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        sessionId: 'session-001',
        type: 'WITHDRAW',
        amount: 199.8,
        performedById: USER_ID,
      }),
    });
  });

  it('should not touch the drawer for an order with no cash session', async () => {
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ status: 'DELIVERED', origin: 'MANUAL', cashRegisterSessionId: null }),
    );
    prisma.accountsReceivable.findMany.mockResolvedValue([
      { id: 'ar-1', paidAmount: 199.8, amount: 199.8, status: 'PAID' },
    ]);

    await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.cashRegisterMovement.create).not.toHaveBeenCalled();
  });

  // ─── Order state ────────────────────────────────────────────────────

  it('should move the order to RETURNED and record who did it and why', async () => {
    await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RETURNED' }),
      }),
    );
    expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: ORDER_ID,
        fromStatus: 'COMPLETED',
        toStatus: 'RETURNED',
        changedBy: USER_ID,
        notes: expect.stringContaining('Cliente desistiu da compra'),
      }),
    });
  });

  it('should run every side effect inside a single transaction', async () => {
    await useCase.execute(TENANT_ID, ORDER_ID, USER_ID, reason);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

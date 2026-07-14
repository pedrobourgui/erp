import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExchangeOrderItemUseCase } from './exchange-order-item.use-case';
import { PrismaService } from '../../../database/prisma/prisma.service';

const TENANT_A = 'tenant-aaa-111';
const ORDER_ID = 'order-1';
const USER_ID = 'user-1';

function createMockTx() {
  return {
    inventoryItem: {
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue({ id: 'inv-old' }),
      create: jest.fn().mockResolvedValue({}),
    },
    inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    orderItem: {
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([{ totalPrice: 120 }]),
    },
    order: { update: jest.fn().mockResolvedValue({}) },
    accountsReceivable: { create: jest.fn().mockResolvedValue({ id: 'ar-1' }) },
    accountsPayable: { create: jest.fn().mockResolvedValue({ id: 'ap-1' }) },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  };
}

function createMockPrisma(tx: ReturnType<typeof createMockTx>) {
  return {
    order: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    productVariant: { findFirst: jest.fn() },
    warehouse: { findFirst: jest.fn() },
    inventoryItem: { findFirst: jest.fn() },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    tenantId: TENANT_A,
    orderNumber: 'PED-000001',
    status: 'CONFIRMED',
    discount: 0,
    shippingCost: 0,
    customerId: 'cust-1',
    items: [
      {
        id: 'item-1',
        productId: 'prod-old',
        variantId: null,
        quantity: 2,
        totalPrice: 100,
        name: 'Produto Antigo',
      },
    ],
    ...overrides,
  };
}

describe('ExchangeOrderItemUseCase', () => {
  let useCase: ExchangeOrderItemUseCase;
  let prisma: ReturnType<typeof createMockPrisma>;
  let tx: ReturnType<typeof createMockTx>;

  beforeEach(async () => {
    tx = createMockTx();
    prisma = createMockPrisma(tx);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeOrderItemUseCase,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    useCase = module.get(ExchangeOrderItemUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  function primeHappyPath(salePrice: number) {
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.product.findFirst.mockResolvedValue({
      id: 'prod-new',
      sku: 'SKU-NEW',
      name: 'Produto Novo',
      salePrice,
      ncm: null,
    });
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
    prisma.inventoryItem.findFirst.mockResolvedValue({
      id: 'inv-new',
      warehouseId: 'wh-1',
    });
  }

  const dto = { orderItemId: 'item-1', newProductId: 'prod-new' };

  it('should adjust stock (issue new + return old) and swap the order item', async () => {
    primeHappyPath(60); // 60 * 2 = 120

    await useCase.execute(TENANT_A, ORDER_ID, USER_ID, dto);

    // issue new item (EXIT)
    expect(tx.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-new' },
        data: { quantity: { decrement: 2 }, available: { decrement: 2 } },
      }),
    );
    const movementTypes = tx.inventoryMovement.create.mock.calls.map(
      (c) => c[0].data.type,
    );
    expect(movementTypes).toEqual(['EXIT', 'RETURN']);
    expect(tx.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1' },
        data: expect.objectContaining({ productId: 'prod-new', totalPrice: 120 }),
      }),
    );
  });

  it('should create a receivable when the difference is positive', async () => {
    primeHappyPath(60); // new 120 vs old 100 -> +20

    const result = await useCase.execute(TENANT_A, ORDER_ID, USER_ID, dto);

    expect(result.difference).toBe(20);
    expect(result.differenceKind).toBe('RECEIVABLE');
    expect(tx.accountsReceivable.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 20 }) }),
    );
    expect(tx.accountsPayable.create).not.toHaveBeenCalled();
  });

  it('should create a payable when the difference is negative', async () => {
    primeHappyPath(30); // new 60 vs old 100 -> -40

    const result = await useCase.execute(TENANT_A, ORDER_ID, USER_ID, dto);

    expect(result.difference).toBe(-40);
    expect(result.differenceKind).toBe('PAYABLE');
    expect(tx.accountsPayable.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 40 }) }),
    );
    expect(tx.accountsReceivable.create).not.toHaveBeenCalled();
  });

  it('should not create any financial entry when there is no difference', async () => {
    primeHappyPath(50); // new 100 vs old 100 -> 0

    const result = await useCase.execute(TENANT_A, ORDER_ID, USER_ID, dto);

    expect(result.differenceKind).toBe('NONE');
    expect(result.financialEntryId).toBeNull();
    expect(tx.accountsReceivable.create).not.toHaveBeenCalled();
    expect(tx.accountsPayable.create).not.toHaveBeenCalled();
  });

  it('should record the exchange in the order status history', async () => {
    primeHappyPath(60);

    await useCase.execute(TENANT_A, ORDER_ID, USER_ID, dto);

    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: ORDER_ID, changedBy: USER_ID }),
      }),
    );
  });

  it('should block the exchange when the new item has insufficient stock', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.product.findFirst.mockResolvedValue({
      id: 'prod-new',
      sku: 'SKU-NEW',
      name: 'Produto Novo',
      salePrice: 60,
      ncm: null,
    });
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
    prisma.inventoryItem.findFirst.mockResolvedValue(null); // no stock

    await expect(
      useCase.execute(TENANT_A, ORDER_ID, USER_ID, dto),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should throw NotFound when the order item does not exist', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder());

    await expect(
      useCase.execute(TENANT_A, ORDER_ID, USER_ID, {
        orderItemId: 'nope',
        newProductId: 'prod-new',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFound when the order is from another tenant', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(TENANT_A, ORDER_ID, USER_ID, dto),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID, tenantId: TENANT_A, deletedAt: null },
      }),
    );
  });

  it('should throw NotFound when the new product does not exist', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(TENANT_A, ORDER_ID, USER_ID, dto),
    ).rejects.toThrow(NotFoundException);
  });
});

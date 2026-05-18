import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateMovementDto, TransferStockDto } from './dto/inventory.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-aaa-111';
const TENANT_B = 'tenant-bbb-222';
const USER_ID = 'user-001';
const PRODUCT_ID = 'prod-001';
const VARIANT_ID = 'var-001';
const WAREHOUSE_A = 'wh-aaa';
const WAREHOUSE_B = 'wh-bbb';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInventoryItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ii-001',
    tenantId: TENANT_A,
    productId: PRODUCT_ID,
    variantId: null,
    warehouseId: WAREHOUSE_A,
    quantity: 100,
    reserved: 10,
    available: 90,
    minStock: 20,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeMovement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mov-001',
    tenantId: TENANT_A,
    productId: PRODUCT_ID,
    variantId: null,
    type: 'ENTRY',
    reason: 'PURCHASE',
    quantity: 10,
    fromWarehouseId: null,
    toWarehouseId: WAREHOUSE_A,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── Mock Factory ─────────────────────────────────────────────────────────────

function createMockPrisma() {
  const mockTx = {
    inventoryItem: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  return {
    product: {
      findFirst: jest.fn(),
    },
    inventoryItem: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    inventoryMovement: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    stockAlert: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    _tx: mockTx, // expose for test assertions
  };
}

function createMockEventEmitter() {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    eventEmitter = createMockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── findAll (getStock) ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return inventory items for tenant', async () => {
      const items = [makeInventoryItem()];
      prisma.inventoryItem.findMany.mockResolvedValue(items);
      prisma.inventoryItem.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A, { page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);

      const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
    });

    it('should filter by warehouseId', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.inventoryItem.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { page: 1, limit: 20, warehouseId: WAREHOUSE_A });

      const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
      expect(whereArg.warehouseId).toBe(WAREHOUSE_A);
    });

    it('should filter by productId', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.inventoryItem.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { page: 1, limit: 20, productId: PRODUCT_ID });

      const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
      expect(whereArg.productId).toBe(PRODUCT_ID);
    });

    it('should search by product name or SKU', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.inventoryItem.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { page: 1, limit: 20, search: 'Widget' });

      const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
      expect(whereArg.product).toBeDefined();
      expect(whereArg.product.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: { contains: 'Widget', mode: 'insensitive' } }),
          expect.objectContaining({ sku: { contains: 'Widget', mode: 'insensitive' } }),
        ]),
      );
    });

    it('should include product info via include', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.inventoryItem.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { page: 1, limit: 20 });

      const includeArg = prisma.inventoryItem.findMany.mock.calls[0][0].include;
      expect(includeArg.product).toBeDefined();
      expect(includeArg.warehouse).toBeDefined();
    });

    it('should NOT return items from other tenants', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      prisma.inventoryItem.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { page: 1, limit: 20 });

      const whereArg = prisma.inventoryItem.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
      expect(whereArg.tenantId).not.toBe(TENANT_B);
    });
  });

  // ─── createMovement ─────────────────────────────────────────────────────

  describe('createMovement', () => {
    const tx = () => prisma._tx;

    beforeEach(() => {
      prisma.product.findFirst.mockResolvedValue({ id: PRODUCT_ID, sku: 'PRD-001', name: 'Widget' });
      // Default mock for checkAndUpdateAlerts after movement
      prisma.inventoryItem.findFirst.mockResolvedValue(makeInventoryItem({ available: 90, minStock: 20 }));
      prisma.stockAlert.updateMany.mockResolvedValue({ count: 0 });
    });

    it('ENTRY: should increase quantity and available', async () => {
      const existingItem = makeInventoryItem({ quantity: 100, available: 90 });
      tx().inventoryItem.findFirst.mockResolvedValue(existingItem);
      tx().inventoryItem.update.mockResolvedValue({});
      tx().inventoryMovement.create.mockResolvedValue(makeMovement());

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'ENTRY',
        reason: 'PURCHASE',
        quantity: 20,
        toWarehouseId: WAREHOUSE_A,
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      expect(tx().inventoryMovement.create).toHaveBeenCalledTimes(1);
      const updateArgs = tx().inventoryItem.update.mock.calls[0][0];
      expect(updateArgs.data.quantity).toBe(120); // 100 + 20
      expect(updateArgs.data.available).toBe(110); // 90 + 20
    });

    it('EXIT: should decrease quantity and available', async () => {
      const existingItem = makeInventoryItem({ quantity: 100, available: 90 });
      tx().inventoryItem.findFirst.mockResolvedValue(existingItem);
      tx().inventoryItem.update.mockResolvedValue({});
      tx().inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'EXIT' }));

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'EXIT',
        reason: 'SALE',
        quantity: 10,
        fromWarehouseId: WAREHOUSE_A,
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      const updateArgs = tx().inventoryItem.update.mock.calls[0][0];
      expect(updateArgs.data.quantity).toBe(90);  // 100 - 10
      expect(updateArgs.data.available).toBe(80); // 90 - 10
    });

    it('EXIT: should throw BadRequestException when insufficient stock', async () => {
      const existingItem = makeInventoryItem({ quantity: 5, available: 5 });
      tx().inventoryItem.findFirst.mockResolvedValue(existingItem);
      tx().inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'EXIT' }));

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'EXIT',
        reason: 'SALE',
        quantity: 10,
        fromWarehouseId: WAREHOUSE_A,
      };

      await expect(service.createMovement(TENANT_A, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ADJUSTMENT: should apply positive delta when toWarehouseId is given', async () => {
      const existingItem = makeInventoryItem({ quantity: 50, available: 40 });
      tx().inventoryItem.findFirst.mockResolvedValue(existingItem);
      tx().inventoryItem.update.mockResolvedValue({});
      tx().inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'ADJUSTMENT' }));

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'ADJUSTMENT',
        reason: 'COUNT',
        quantity: 10,
        toWarehouseId: WAREHOUSE_A,
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      const updateArgs = tx().inventoryItem.update.mock.calls[0][0];
      expect(updateArgs.data.quantity).toBe(60); // 50 + 10
      expect(updateArgs.data.available).toBe(50); // 40 + 10
    });

    it('ADJUSTMENT: should apply negative delta when fromWarehouseId is given', async () => {
      const existingItem = makeInventoryItem({ quantity: 50, available: 40 });
      tx().inventoryItem.findFirst.mockResolvedValue(existingItem);
      tx().inventoryItem.update.mockResolvedValue({});
      tx().inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'ADJUSTMENT' }));

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'ADJUSTMENT',
        reason: 'ADJUSTMENT',
        quantity: 5,
        fromWarehouseId: WAREHOUSE_A,
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      const updateArgs = tx().inventoryItem.update.mock.calls[0][0];
      expect(updateArgs.data.quantity).toBe(45); // 50 - 5
      expect(updateArgs.data.available).toBe(35); // 40 - 5
    });

    it('should create InventoryMovement record', async () => {
      tx().inventoryItem.findFirst.mockResolvedValue(makeInventoryItem());
      tx().inventoryItem.update.mockResolvedValue({});
      tx().inventoryMovement.create.mockResolvedValue(makeMovement());

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'ENTRY',
        reason: 'PURCHASE',
        quantity: 5,
        toWarehouseId: WAREHOUSE_A,
        unitCost: 10,
        notes: 'Test entry',
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      const createArgs = tx().inventoryMovement.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(TENANT_A);
      expect(createArgs.data.productId).toBe(PRODUCT_ID);
      expect(createArgs.data.type).toBe('ENTRY');
      expect(createArgs.data.quantity).toBe(5);
      expect(createArgs.data.unitCost).toBe(10);
      expect(createArgs.data.totalCost).toBe(50); // 10 * 5
      expect(createArgs.data.userId).toBe(USER_ID);
    });

    it('should upsert InventoryItem if not exists', async () => {
      tx().inventoryItem.findFirst.mockResolvedValue(null); // No existing item
      tx().inventoryItem.create.mockResolvedValue({});
      tx().inventoryMovement.create.mockResolvedValue(makeMovement());

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'ENTRY',
        reason: 'INITIAL',
        quantity: 25,
        toWarehouseId: WAREHOUSE_A,
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      expect(tx().inventoryItem.create).toHaveBeenCalledTimes(1);
      const createArgs = tx().inventoryItem.create.mock.calls[0][0];
      expect(createArgs.data.quantity).toBe(25);
      expect(createArgs.data.available).toBe(25);
      expect(createArgs.data.reserved).toBe(0);
      expect(createArgs.data.tenantId).toBe(TENANT_A);
    });

    it('should throw NotFoundException when product not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      const dto: CreateMovementDto = {
        productId: 'non-existent',
        type: 'ENTRY',
        reason: 'PURCHASE',
        quantity: 10,
        toWarehouseId: WAREHOUSE_A,
      };

      await expect(service.createMovement(TENANT_A, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when creating item with negative quantity', async () => {
      tx().inventoryItem.findFirst.mockResolvedValue(null); // No existing item
      tx().inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'EXIT' }));

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'EXIT',
        reason: 'SALE',
        quantity: 10,
        fromWarehouseId: WAREHOUSE_A,
      };

      await expect(service.createMovement(TENANT_A, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ENTRY: should throw BadRequestException when toWarehouseId is missing', async () => {
      tx().inventoryMovement.create.mockResolvedValue(makeMovement());

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'ENTRY',
        reason: 'PURCHASE',
        quantity: 10,
        // toWarehouseId intentionally missing
      };

      await expect(service.createMovement(TENANT_A, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('EXIT: should throw BadRequestException when fromWarehouseId is missing', async () => {
      tx().inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'EXIT' }));

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'EXIT',
        reason: 'SALE',
        quantity: 10,
        // fromWarehouseId intentionally missing
      };

      await expect(service.createMovement(TENANT_A, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── findMovements ──────────────────────────────────────────────────────

  describe('findMovements', () => {
    it('should return paginated movement history', async () => {
      const movements = [makeMovement()];
      prisma.inventoryMovement.findMany.mockResolvedValue(movements);
      prisma.inventoryMovement.count.mockResolvedValue(1);

      const result = await service.findMovements(TENANT_A, { page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);

      const whereArg = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
    });

    it('should filter by type', async () => {
      prisma.inventoryMovement.findMany.mockResolvedValue([]);
      prisma.inventoryMovement.count.mockResolvedValue(0);

      await service.findMovements(TENANT_A, { page: 1, limit: 20, type: 'EXIT' });

      const whereArg = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
      expect(whereArg.type).toBe('EXIT');
    });

    it('should filter by warehouseId (from or to)', async () => {
      prisma.inventoryMovement.findMany.mockResolvedValue([]);
      prisma.inventoryMovement.count.mockResolvedValue(0);

      await service.findMovements(TENANT_A, { page: 1, limit: 20, warehouseId: WAREHOUSE_A });

      const whereArg = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual([
        { fromWarehouseId: WAREHOUSE_A },
        { toWarehouseId: WAREHOUSE_A },
      ]);
    });

    it('should filter by date range', async () => {
      prisma.inventoryMovement.findMany.mockResolvedValue([]);
      prisma.inventoryMovement.count.mockResolvedValue(0);

      await service.findMovements(TENANT_A, {
        page: 1,
        limit: 20,
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
      });

      const whereArg = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
      expect(whereArg.createdAt.gte).toEqual(new Date('2026-01-01'));
      expect(whereArg.createdAt.lte).toEqual(new Date('2026-03-31'));
    });
  });

  // ─── reserveStock ───────────────────────────────────────────────────────

  describe('reserveStock', () => {
    it('should increase reserved and decrease available', async () => {
      const item = makeInventoryItem({ available: 90, reserved: 10, minStock: 0 });
      prisma.inventoryItem.findFirst.mockResolvedValue(item);
      prisma.inventoryItem.update.mockResolvedValue({});
      prisma.inventoryItem.findUnique.mockResolvedValue({ ...item, available: 80, reserved: 20, minStock: 0 });

      await service.reserveStock(TENANT_A, PRODUCT_ID, null, 10);

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'ii-001' },
        data: {
          reserved: { increment: 10 },
          available: { decrement: 10 },
        },
      });
    });

    it('should gracefully skip when insufficient available stock', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null); // No item with enough stock

      // Should NOT throw
      await expect(
        service.reserveStock(TENANT_A, PRODUCT_ID, null, 9999),
      ).resolves.toBeUndefined();

      expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
    });

    it('should work correctly with variantId', async () => {
      const item = makeInventoryItem({ variantId: VARIANT_ID, available: 50, minStock: 0 });
      prisma.inventoryItem.findFirst.mockResolvedValue(item);
      prisma.inventoryItem.update.mockResolvedValue({});
      prisma.inventoryItem.findUnique.mockResolvedValue({ ...item, available: 40, reserved: 20, minStock: 0 });

      await service.reserveStock(TENANT_A, PRODUCT_ID, VARIANT_ID, 10);

      const findArgs = prisma.inventoryItem.findFirst.mock.calls[0][0];
      expect(findArgs.where.variantId).toBe(VARIANT_ID);
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });

    it('should NOT affect other tenants stock', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await service.reserveStock(TENANT_A, PRODUCT_ID, null, 5);

      const findArgs = prisma.inventoryItem.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });

    it('should trigger low stock alert when available drops below minStock', async () => {
      const item = makeInventoryItem({ available: 25, reserved: 5, minStock: 20 });
      prisma.inventoryItem.findFirst.mockResolvedValue(item);
      prisma.inventoryItem.update.mockResolvedValue({});
      // After reservation: available = 15 which is <= minStock(20)
      prisma.inventoryItem.findUnique.mockResolvedValue({
        ...item,
        available: 15,
        reserved: 15,
        minStock: 20,
      });
      prisma.stockAlert.findFirst.mockResolvedValue(null); // No existing alert
      prisma.stockAlert.create.mockResolvedValue({});

      await service.reserveStock(TENANT_A, PRODUCT_ID, null, 10);

      expect(prisma.stockAlert.create).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'stock.low',
        expect.objectContaining({
          tenantId: TENANT_A,
          productId: PRODUCT_ID,
          currentQty: 15,
          minStock: 20,
        }),
      );
    });
  });

  // ─── releaseStock ───────────────────────────────────────────────────────

  describe('releaseStock', () => {
    it('should decrease reserved and increase available', async () => {
      const item = makeInventoryItem({ available: 80, reserved: 20, minStock: 0 });
      prisma.inventoryItem.findFirst.mockResolvedValue(item);
      prisma.inventoryItem.update.mockResolvedValue({});
      prisma.inventoryItem.findUnique.mockResolvedValue({ ...item, available: 90, reserved: 10, minStock: 0 });

      await service.releaseStock(TENANT_A, PRODUCT_ID, null, 10);

      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'ii-001' },
        data: {
          reserved: { decrement: 10 },
          available: { increment: 10 },
        },
      });
    });

    it('should gracefully skip when no matching reservation found', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      // Should NOT throw
      await expect(
        service.releaseStock(TENANT_A, PRODUCT_ID, null, 100),
      ).resolves.toBeUndefined();

      expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
    });

    it('should scope query by tenantId', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await service.releaseStock(TENANT_A, PRODUCT_ID, null, 5);

      const findArgs = prisma.inventoryItem.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── transferStock ──────────────────────────────────────────────────────

  describe('transferStock', () => {
    const baseTransferDto: TransferStockDto = {
      productId: PRODUCT_ID,
      fromWarehouseId: WAREHOUSE_A,
      toWarehouseId: WAREHOUSE_B,
      quantity: 10,
    };

    beforeEach(() => {
      prisma.product.findFirst.mockResolvedValue({ id: PRODUCT_ID, sku: 'PRD-001' });
      // Default mock for checkAndUpdateAlerts: item above minStock, no alerts needed
      prisma.inventoryItem.findFirst.mockResolvedValue(makeInventoryItem({ available: 90, minStock: 20 }));
      prisma.stockAlert.updateMany.mockResolvedValue({ count: 0 });
    });

    it('should decrease stock in source warehouse and increase in destination', async () => {
      const sourceItem = makeInventoryItem({ warehouseId: WAREHOUSE_A, quantity: 100, available: 90 });
      prisma.inventoryItem.findFirst.mockResolvedValue(sourceItem);

      const tx = prisma._tx;
      // Source lookup
      tx.inventoryItem.findFirst
        .mockResolvedValueOnce(sourceItem) // source upsert lookup
        .mockResolvedValueOnce(makeInventoryItem({ warehouseId: WAREHOUSE_B, quantity: 50, available: 50 })); // dest upsert lookup
      tx.inventoryItem.update.mockResolvedValue({});
      tx.inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'TRANSFER' }));

      await service.transferStock(TENANT_A, USER_ID, baseTransferDto);

      // Source: quantity 100 - 10 = 90, available 90 - 10 = 80
      const sourceUpdateArgs = tx.inventoryItem.update.mock.calls[0][0];
      expect(sourceUpdateArgs.data.quantity).toBe(90);
      expect(sourceUpdateArgs.data.available).toBe(80);

      // Destination: quantity 50 + 10 = 60, available 50 + 10 = 60
      const destUpdateArgs = tx.inventoryItem.update.mock.calls[1][0];
      expect(destUpdateArgs.data.quantity).toBe(60);
      expect(destUpdateArgs.data.available).toBe(60);
    });

    it('should create a TRANSFER movement record', async () => {
      const sourceItem = makeInventoryItem({ available: 90 });
      prisma.inventoryItem.findFirst.mockResolvedValue(sourceItem);

      const tx = prisma._tx;
      tx.inventoryItem.findFirst.mockResolvedValue(makeInventoryItem());
      tx.inventoryItem.update.mockResolvedValue({});
      tx.inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'TRANSFER' }));

      await service.transferStock(TENANT_A, USER_ID, baseTransferDto);

      const movementArgs = tx.inventoryMovement.create.mock.calls[0][0];
      expect(movementArgs.data.type).toBe('TRANSFER');
      expect(movementArgs.data.fromWarehouseId).toBe(WAREHOUSE_A);
      expect(movementArgs.data.toWarehouseId).toBe(WAREHOUSE_B);
      expect(movementArgs.data.quantity).toBe(10);
      expect(movementArgs.data.tenantId).toBe(TENANT_A);
    });

    it('should throw BadRequestException when insufficient stock in source', async () => {
      const sourceItem = makeInventoryItem({ available: 5 });
      prisma.inventoryItem.findFirst.mockResolvedValue(sourceItem);

      const dto: TransferStockDto = { ...baseTransferDto, quantity: 10 };

      await expect(service.transferStock(TENANT_A, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when source has no inventory item', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(service.transferStock(TENANT_A, USER_ID, baseTransferDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when source and destination are the same', async () => {
      const dto: TransferStockDto = {
        ...baseTransferDto,
        fromWarehouseId: WAREHOUSE_A,
        toWarehouseId: WAREHOUSE_A,
      };

      await expect(service.transferStock(TENANT_A, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when product not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.transferStock(TENANT_A, USER_ID, baseTransferDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use $transaction to ensure atomicity', async () => {
      const sourceItem = makeInventoryItem({ available: 90 });
      prisma.inventoryItem.findFirst.mockResolvedValue(sourceItem);

      const tx = prisma._tx;
      tx.inventoryItem.findFirst.mockResolvedValue(makeInventoryItem());
      tx.inventoryItem.update.mockResolvedValue({});
      tx.inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'TRANSFER' }));

      await service.transferStock(TENANT_A, USER_ID, baseTransferDto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should rollback if transaction callback throws', async () => {
      const sourceItem = makeInventoryItem({ available: 90 });
      prisma.inventoryItem.findFirst.mockResolvedValue(sourceItem);

      // Make the transaction fail
      prisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.transferStock(TENANT_A, USER_ID, baseTransferDto)).rejects.toThrow(
        'DB connection lost',
      );
    });

    it('should verify tenant isolation on transfer', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.transferStock(TENANT_A, USER_ID, baseTransferDto),
      ).rejects.toThrow(NotFoundException);

      const findArgs = prisma.product.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── getLowStockAlerts ──────────────────────────────────────────────────

  describe('getLowStockAlerts', () => {
    it('should return low stock items via raw query', async () => {
      const lowStockItems = [
        {
          id: 'ii-001',
          productId: PRODUCT_ID,
          warehouseId: WAREHOUSE_A,
          available: 5,
          minStock: 20,
          productName: 'Widget',
          productSku: 'PRD-001',
          warehouseName: 'Main',
          warehouseCode: 'MAIN',
        },
      ];
      prisma.stockAlert.findMany.mockResolvedValue(lowStockItems);
      prisma.stockAlert.count.mockResolvedValue(1);

      const result = await service.getLowStockAlerts(TENANT_A, {});

      expect(result.data).toEqual(lowStockItems);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].available).toBeLessThanOrEqual(result.data[0].minStock);
    });
  });

  // ─── checkLowStock ─────────────────────────────────────────────────────

  describe('checkLowStock', () => {
    it('should find items where available <= minStock and create alerts', async () => {
      const lowStockItems = [
        { productId: PRODUCT_ID, variantId: null, warehouseId: WAREHOUSE_A, available: 5, minStock: 20 },
      ];
      prisma.$queryRaw.mockResolvedValue(lowStockItems);
      prisma.stockAlert.findFirst.mockResolvedValue(null); // No existing alert
      prisma.stockAlert.create.mockResolvedValue({});

      await service.checkLowStock(TENANT_A);

      expect(prisma.stockAlert.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.stockAlert.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(TENANT_A);
      expect(createArgs.data.productId).toBe(PRODUCT_ID);
      expect(createArgs.data.currentQty).toBe(5);
      expect(createArgs.data.minStock).toBe(20);
    });

    it('should emit STOCK_LOW event for each low stock item', async () => {
      const lowStockItems = [
        { productId: PRODUCT_ID, variantId: null, warehouseId: WAREHOUSE_A, available: 3, minStock: 10 },
      ];
      prisma.$queryRaw.mockResolvedValue(lowStockItems);
      prisma.stockAlert.findFirst.mockResolvedValue(null);
      prisma.stockAlert.create.mockResolvedValue({});

      await service.checkLowStock(TENANT_A);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'stock.low',
        expect.objectContaining({
          eventName: 'stock.low',
          tenantId: TENANT_A,
          productId: PRODUCT_ID,
          currentQty: 3,
          minStock: 10,
        }),
      );
    });

    it('should not create duplicate alerts for same product/warehouse', async () => {
      const lowStockItems = [
        { productId: PRODUCT_ID, variantId: null, warehouseId: WAREHOUSE_A, available: 5, minStock: 20 },
      ];
      prisma.$queryRaw.mockResolvedValue(lowStockItems);
      prisma.stockAlert.findFirst.mockResolvedValue({ id: 'alert-existing', isResolved: false }); // Already exists

      await service.checkLowStock(TENANT_A);

      expect(prisma.stockAlert.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should handle empty low stock results gracefully', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.checkLowStock(TENANT_A);

      expect(prisma.stockAlert.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should process multiple low stock items', async () => {
      const lowStockItems = [
        { productId: 'prod-001', variantId: null, warehouseId: WAREHOUSE_A, available: 1, minStock: 10 },
        { productId: 'prod-002', variantId: null, warehouseId: WAREHOUSE_B, available: 3, minStock: 15 },
      ];
      prisma.$queryRaw.mockResolvedValue(lowStockItems);
      prisma.stockAlert.findFirst.mockResolvedValue(null);
      prisma.stockAlert.create.mockResolvedValue({});

      await service.checkLowStock(TENANT_A);

      expect(prisma.stockAlert.create).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(() => {
      // Default mock for checkAndUpdateAlerts after movement
      prisma.inventoryItem.findFirst.mockResolvedValue(makeInventoryItem({ available: 90, minStock: 20 }));
      prisma.stockAlert.updateMany.mockResolvedValue({ count: 0 });
    });

    it('should handle zero quantity in inventory item', async () => {
      const tx = prisma._tx;
      const existingItem = makeInventoryItem({ quantity: 0, available: 0 });
      tx.inventoryItem.findFirst.mockResolvedValue(existingItem);
      tx.inventoryItem.update.mockResolvedValue({});
      tx.inventoryMovement.create.mockResolvedValue(makeMovement());
      prisma.product.findFirst.mockResolvedValue({ id: PRODUCT_ID, sku: 'PRD-001', name: 'Widget' });

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'ENTRY',
        reason: 'PURCHASE',
        quantity: 5,
        toWarehouseId: WAREHOUSE_A,
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      const updateArgs = tx.inventoryItem.update.mock.calls[0][0];
      expect(updateArgs.data.quantity).toBe(5);
      expect(updateArgs.data.available).toBe(5);
    });

    it('should handle RETURN movement type like ENTRY', async () => {
      const tx = prisma._tx;
      tx.inventoryItem.findFirst.mockResolvedValue(makeInventoryItem());
      tx.inventoryItem.update.mockResolvedValue({});
      tx.inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'RETURN' }));
      prisma.product.findFirst.mockResolvedValue({ id: PRODUCT_ID, sku: 'PRD-001', name: 'Widget' });

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'RETURN',
        reason: 'RETURN_CUSTOMER',
        quantity: 3,
        toWarehouseId: WAREHOUSE_A,
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      // RETURN should increase stock like ENTRY
      const updateArgs = tx.inventoryItem.update.mock.calls[0][0];
      expect(updateArgs.data.quantity).toBe(103); // 100 + 3
    });

    it('should handle PRODUCTION movement type like ENTRY', async () => {
      const tx = prisma._tx;
      tx.inventoryItem.findFirst.mockResolvedValue(makeInventoryItem());
      tx.inventoryItem.update.mockResolvedValue({});
      tx.inventoryMovement.create.mockResolvedValue(makeMovement({ type: 'PRODUCTION' }));
      prisma.product.findFirst.mockResolvedValue({ id: PRODUCT_ID, sku: 'PRD-001', name: 'Widget' });

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'PRODUCTION',
        reason: 'PRODUCTION',
        quantity: 20,
        toWarehouseId: WAREHOUSE_A,
      };
      await service.createMovement(TENANT_A, USER_ID, dto);

      const updateArgs = tx.inventoryItem.update.mock.calls[0][0];
      expect(updateArgs.data.quantity).toBe(120); // 100 + 20
    });
  });

  // ─── getWarehouses ────────────────────────────────────────────────────

  describe('getWarehouses', () => {
    beforeEach(() => {
      // Need warehouse mock on prisma
      (prisma as any).warehouse = {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      };
    });

    it('should return paginated warehouses for tenant', async () => {
      const warehouses = [
        { id: 'wh-001', name: 'Deposito Principal', code: 'DEP-001', address: 'Rua A, 1', isDefault: true, createdAt: new Date(), updatedAt: new Date() },
      ];
      (prisma as any).warehouse.findMany.mockResolvedValue(warehouses);
      (prisma as any).warehouse.count.mockResolvedValue(1);

      const result = await service.getWarehouses(TENANT_A, { page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(warehouses);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should scope query by tenantId', async () => {
      (prisma as any).warehouse.findMany.mockResolvedValue([]);
      (prisma as any).warehouse.count.mockResolvedValue(0);

      await service.getWarehouses(TENANT_A, { page: 1, limit: 20 });

      const whereArg = (prisma as any).warehouse.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
    });

    it('should NOT return warehouses from other tenants', async () => {
      (prisma as any).warehouse.findMany.mockResolvedValue([]);
      (prisma as any).warehouse.count.mockResolvedValue(0);

      await service.getWarehouses(TENANT_A, { page: 1, limit: 20 });

      const whereArg = (prisma as any).warehouse.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
      expect(whereArg.tenantId).not.toBe(TENANT_B);
    });

    it('should apply pagination (skip and take)', async () => {
      (prisma as any).warehouse.findMany.mockResolvedValue([]);
      (prisma as any).warehouse.count.mockResolvedValue(0);

      await service.getWarehouses(TENANT_A, { page: 2, limit: 10 });

      const call = (prisma as any).warehouse.findMany.mock.calls[0][0];
      expect(call.skip).toBe(10); // (2-1) * 10
      expect(call.take).toBe(10);
    });

    it('should order by createdAt desc', async () => {
      (prisma as any).warehouse.findMany.mockResolvedValue([]);
      (prisma as any).warehouse.count.mockResolvedValue(0);

      await service.getWarehouses(TENANT_A, { page: 1, limit: 20 });

      const call = (prisma as any).warehouse.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  // ─── createWarehouse ──────────────────────────────────────────────────

  describe('createWarehouse', () => {
    beforeEach(() => {
      (prisma as any).warehouse = {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      };
    });

    it('should create a warehouse with provided data', async () => {
      const dto = { name: 'Novo Deposito', code: 'ND-001', address: 'Rua B, 2', isDefault: false };
      const created = { id: 'wh-new', ...dto, tenantId: TENANT_A, createdAt: new Date(), updatedAt: new Date() };
      (prisma as any).warehouse.create.mockResolvedValue(created);

      const result = await service.createWarehouse(TENANT_A, dto as any);

      expect(result).toEqual(created);
      expect((prisma as any).warehouse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_A,
          name: dto.name,
          code: dto.code,
          address: dto.address,
          isDefault: false,
        }),
        select: expect.objectContaining({
          id: true,
          name: true,
          code: true,
        }),
      });
    });

    it('should scope warehouse to tenantId', async () => {
      const dto = { name: 'Test', code: 'TST', address: null };
      (prisma as any).warehouse.create.mockResolvedValue({ id: 'wh-new', ...dto, tenantId: TENANT_A });

      await service.createWarehouse(TENANT_A, dto as any);

      const createArgs = (prisma as any).warehouse.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(TENANT_A);
    });

    it('should default isDefault to false when not provided', async () => {
      const dto = { name: 'Test', code: 'TST', address: null };
      (prisma as any).warehouse.create.mockResolvedValue({ id: 'wh-new', ...dto, tenantId: TENANT_A, isDefault: false });

      await service.createWarehouse(TENANT_A, dto as any);

      const createArgs = (prisma as any).warehouse.create.mock.calls[0][0];
      expect(createArgs.data.isDefault).toBe(false);
    });
  });
});

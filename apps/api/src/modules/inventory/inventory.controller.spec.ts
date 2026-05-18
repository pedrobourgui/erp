import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateMovementDto,
  TransferStockDto,
  InventoryQueryDto,
  MovementQueryDto,
} from './dto/inventory.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-aaa-111';
const USER_ID = 'user-001';
const PRODUCT_ID = 'prod-001';
const WAREHOUSE_A = 'wh-aaa';
const WAREHOUSE_B = 'wh-bbb';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInventoryItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ii-001',
    tenantId: TENANT_ID,
    productId: PRODUCT_ID,
    quantity: 100,
    reserved: 10,
    available: 90,
    ...overrides,
  };
}

function makeMovement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mov-001',
    tenantId: TENANT_ID,
    productId: PRODUCT_ID,
    type: 'ENTRY',
    quantity: 10,
    ...overrides,
  };
}

function makePaginatedResponse(data: unknown[] = []) {
  return {
    success: true,
    data,
    meta: { total: data.length, page: 1, limit: 20, totalPages: 1, hasMore: false },
  };
}

// ─── Mock Service ─────────────────────────────────────────────────────────────

function createMockInventoryService() {
  return {
    findAll: jest.fn(),
    createMovement: jest.fn(),
    findMovements: jest.fn(),
    getLowStockAlerts: jest.fn(),
    transferStock: jest.fn(),
    reserveStock: jest.fn(),
    releaseStock: jest.fn(),
    checkLowStock: jest.fn(),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: ReturnType<typeof createMockInventoryService>;

  beforeEach(async () => {
    service = createMockInventoryService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: service },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── GET /inventory ─────────────────────────────────────────────────────

  describe('GET /inventory (findAll)', () => {
    it('should return stock list', async () => {
      const paginated = makePaginatedResponse([makeInventoryItem()]);
      service.findAll.mockResolvedValue(paginated);

      const query: InventoryQueryDto = { page: 1, limit: 20 };
      const result = await controller.findAll(TENANT_ID, query);

      expect(result).toEqual(paginated);
      expect(service.findAll).toHaveBeenCalledWith(TENANT_ID, query);
    });

    it('should pass tenantId correctly', async () => {
      service.findAll.mockResolvedValue(makePaginatedResponse());

      await controller.findAll(TENANT_ID, { page: 1, limit: 20 });

      expect(service.findAll.mock.calls[0][0]).toBe(TENANT_ID);
    });

    it('should forward all query filters', async () => {
      service.findAll.mockResolvedValue(makePaginatedResponse());

      const query: InventoryQueryDto = {
        page: 2,
        limit: 10,
        productId: PRODUCT_ID,
        warehouseId: WAREHOUSE_A,
        search: 'widget',
      };
      await controller.findAll(TENANT_ID, query);

      expect(service.findAll).toHaveBeenCalledWith(TENANT_ID, query);
    });
  });

  // ─── POST /inventory/movement ───────────────────────────────────────────

  describe('POST /inventory/movement (createMovement)', () => {
    it('should register movement and return wrapped response', async () => {
      const movement = makeMovement();
      service.createMovement.mockResolvedValue(movement);

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'ENTRY',
        reason: 'PURCHASE',
        quantity: 10,
        toWarehouseId: WAREHOUSE_A,
      };
      const result = await controller.createMovement(TENANT_ID, USER_ID, dto);

      expect(result).toEqual({ success: true, data: movement });
      expect(service.createMovement).toHaveBeenCalledWith(TENANT_ID, USER_ID, dto);
    });

    it('should pass tenantId and userId correctly', async () => {
      service.createMovement.mockResolvedValue(makeMovement());

      const dto: CreateMovementDto = {
        productId: PRODUCT_ID,
        type: 'EXIT',
        reason: 'SALE',
        quantity: 5,
        fromWarehouseId: WAREHOUSE_A,
      };
      await controller.createMovement(TENANT_ID, USER_ID, dto);

      expect(service.createMovement.mock.calls[0][0]).toBe(TENANT_ID);
      expect(service.createMovement.mock.calls[0][1]).toBe(USER_ID);
    });
  });

  // ─── POST /inventory/transfer ───────────────────────────────────────────

  describe('POST /inventory/transfer (transferStock)', () => {
    it('should transfer stock and return wrapped response', async () => {
      const movement = makeMovement({ type: 'TRANSFER' });
      service.transferStock.mockResolvedValue(movement);

      const dto: TransferStockDto = {
        productId: PRODUCT_ID,
        fromWarehouseId: WAREHOUSE_A,
        toWarehouseId: WAREHOUSE_B,
        quantity: 10,
      };
      const result = await controller.transferStock(TENANT_ID, USER_ID, dto);

      expect(result).toEqual({ success: true, data: movement });
      expect(service.transferStock).toHaveBeenCalledWith(TENANT_ID, USER_ID, dto);
    });

    it('should pass tenantId and userId correctly', async () => {
      service.transferStock.mockResolvedValue(makeMovement({ type: 'TRANSFER' }));

      const dto: TransferStockDto = {
        productId: PRODUCT_ID,
        fromWarehouseId: WAREHOUSE_A,
        toWarehouseId: WAREHOUSE_B,
        quantity: 5,
      };
      await controller.transferStock(TENANT_ID, USER_ID, dto);

      expect(service.transferStock.mock.calls[0][0]).toBe(TENANT_ID);
      expect(service.transferStock.mock.calls[0][1]).toBe(USER_ID);
    });
  });

  // ─── GET /inventory/alerts ──────────────────────────────────────────────

  describe('GET /inventory/alerts (getLowStockAlerts)', () => {
    it('should return low stock alerts wrapped in success envelope', async () => {
      const alerts = [
        { id: 'ii-001', productId: PRODUCT_ID, available: 5, minStock: 20 },
      ];
      service.getLowStockAlerts.mockResolvedValue(alerts);

      const result = await controller.getLowStockAlerts(TENANT_ID, {});

      expect(result).toEqual(alerts);
      expect(service.getLowStockAlerts).toHaveBeenCalledWith(TENANT_ID, {});
    });

    it('should pass tenantId correctly', async () => {
      service.getLowStockAlerts.mockResolvedValue([]);

      await controller.getLowStockAlerts(TENANT_ID, {});

      expect(service.getLowStockAlerts.mock.calls[0][0]).toBe(TENANT_ID);
    });

    it('should return empty array when no alerts exist', async () => {
      const emptyResponse = makePaginatedResponse([]);
      service.getLowStockAlerts.mockResolvedValue(emptyResponse);

      const result = await controller.getLowStockAlerts(TENANT_ID, {});

      expect(result).toEqual(emptyResponse);
    });
  });

  // ─── GET /inventory/movements ───────────────────────────────────────────

  describe('GET /inventory/movements (findMovements)', () => {
    it('should return movement history', async () => {
      const paginated = makePaginatedResponse([makeMovement()]);
      service.findMovements.mockResolvedValue(paginated);

      const query: MovementQueryDto = { page: 1, limit: 20 };
      const result = await controller.findMovements(TENANT_ID, query);

      expect(result).toEqual(paginated);
      expect(service.findMovements).toHaveBeenCalledWith(TENANT_ID, query);
    });

    it('should pass tenantId correctly', async () => {
      service.findMovements.mockResolvedValue(makePaginatedResponse());

      await controller.findMovements(TENANT_ID, { page: 1, limit: 20 });

      expect(service.findMovements.mock.calls[0][0]).toBe(TENANT_ID);
    });

    it('should forward all query filters', async () => {
      service.findMovements.mockResolvedValue(makePaginatedResponse());

      const query: MovementQueryDto = {
        page: 1,
        limit: 50,
        productId: PRODUCT_ID,
        warehouseId: WAREHOUSE_A,
        type: 'EXIT',
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
      };
      await controller.findMovements(TENANT_ID, query);

      expect(service.findMovements).toHaveBeenCalledWith(TENANT_ID, query);
    });
  });
});

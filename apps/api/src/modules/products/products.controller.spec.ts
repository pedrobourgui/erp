import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-aaa-111';

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-001',
    tenantId: TENANT_ID,
    sku: 'PRD-000001',
    name: 'Widget',
    costPrice: 10,
    salePrice: 15,
    status: 'ACTIVE',
    ...overrides,
  };
}

function makePaginatedResponse(data: unknown[] = [makeProduct()]) {
  return {
    success: true,
    data,
    meta: { total: data.length, page: 1, limit: 20, totalPages: 1, hasMore: false },
  };
}

// ─── Mock Service ─────────────────────────────────────────────────────────────

function createMockProductsService() {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ReturnType<typeof createMockProductsService>;

  beforeEach(async () => {
    service = createMockProductsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: service },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /products (findAll)', () => {
    it('should return paginated list', async () => {
      const paginated = makePaginatedResponse();
      service.findAll.mockResolvedValue(paginated);

      const query: ProductQueryDto = { page: 1, limit: 20, sortOrder: 'desc' };
      const result = await controller.findAll(TENANT_ID, query);

      expect(result).toEqual(paginated);
      expect(service.findAll).toHaveBeenCalledWith(TENANT_ID, query);
    });

    it('should pass tenantId correctly', async () => {
      service.findAll.mockResolvedValue(makePaginatedResponse([]));

      await controller.findAll(TENANT_ID, { page: 1, limit: 20, sortOrder: 'desc' });

      expect(service.findAll.mock.calls[0][0]).toBe(TENANT_ID);
    });

    it('should forward all query filters to service', async () => {
      service.findAll.mockResolvedValue(makePaginatedResponse([]));

      const query: ProductQueryDto = {
        page: 2,
        limit: 10,
        search: 'widget',
        status: 'ACTIVE',
        categoryId: 'cat-001',
        brandId: 'brand-001',
        sortBy: 'name',
        sortOrder: 'asc',
      };
      await controller.findAll(TENANT_ID, query);

      expect(service.findAll).toHaveBeenCalledWith(TENANT_ID, query);
    });
  });

  describe('GET /products/:id (findOne)', () => {
    it('should return product detail wrapped in success envelope', async () => {
      const product = makeProduct();
      service.findOne.mockResolvedValue(product);

      const result = await controller.findOne(TENANT_ID, 'prod-001');

      expect(result).toEqual({ success: true, data: product });
      expect(service.findOne).toHaveBeenCalledWith(TENANT_ID, 'prod-001');
    });

    it('should pass tenantId correctly', async () => {
      service.findOne.mockResolvedValue(makeProduct());

      await controller.findOne(TENANT_ID, 'prod-001');

      expect(service.findOne.mock.calls[0][0]).toBe(TENANT_ID);
    });
  });

  describe('POST /products (create)', () => {
    it('should create and return product wrapped in success envelope', async () => {
      const product = makeProduct();
      service.create.mockResolvedValue(product);

      const dto: CreateProductDto = { name: 'Widget', costPrice: 10 };
      const result = await controller.create(TENANT_ID, dto);

      expect(result).toEqual({ success: true, data: product });
      expect(service.create).toHaveBeenCalledWith(TENANT_ID, dto);
    });

    it('should pass tenantId correctly', async () => {
      service.create.mockResolvedValue(makeProduct());

      await controller.create(TENANT_ID, { name: 'Test', costPrice: 5 });

      expect(service.create.mock.calls[0][0]).toBe(TENANT_ID);
    });
  });

  describe('PATCH /products/:id (update)', () => {
    it('should update product and return wrapped response', async () => {
      const product = makeProduct({ name: 'Updated' });
      service.update.mockResolvedValue(product);

      const dto: UpdateProductDto = { name: 'Updated' };
      const result = await controller.update(TENANT_ID, 'prod-001', dto);

      expect(result).toEqual({ success: true, data: product });
      expect(service.update).toHaveBeenCalledWith(TENANT_ID, 'prod-001', dto);
    });

    it('should pass tenantId correctly', async () => {
      service.update.mockResolvedValue(makeProduct());

      await controller.update(TENANT_ID, 'prod-001', { name: 'X' });

      expect(service.update.mock.calls[0][0]).toBe(TENANT_ID);
    });
  });

  describe('DELETE /products/:id (remove)', () => {
    it('should soft delete product', async () => {
      service.remove.mockResolvedValue({ success: true, message: 'Product deleted successfully' });

      const result = await controller.remove(TENANT_ID, 'prod-001');

      expect(result).toEqual({ success: true, message: 'Product deleted successfully' });
      expect(service.remove).toHaveBeenCalledWith(TENANT_ID, 'prod-001');
    });

    it('should pass tenantId correctly', async () => {
      service.remove.mockResolvedValue({ success: true, message: 'Product deleted successfully' });

      await controller.remove(TENANT_ID, 'prod-001');

      expect(service.remove.mock.calls[0][0]).toBe(TENANT_ID);
    });
  });
});

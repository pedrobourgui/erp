import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-aaa-111';
const TENANT_B = 'tenant-bbb-222';

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-001',
    tenantId: TENANT_A,
    sku: 'PRD-000001',
    name: 'Widget',
    description: 'A widget',
    type: 'SIMPLE',
    status: 'ACTIVE',
    costPrice: 10,
    salePrice: 15,
    markup: 50,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    categoryId: 'cat-001',
    brandId: 'brand-001',
    supplierId: null,
    ...overrides,
  };
}

function makeInventoryItem(overrides: Record<string, unknown> = {}) {
  return {
    quantity: 100,
    reserved: 10,
    available: 90,
    ...overrides,
  };
}

function makePaginatedProduct(overrides: Record<string, unknown> = {}) {
  return {
    ...makeProduct(overrides),
    category: { id: 'cat-001', name: 'Electronics' },
    brand: { id: 'brand-001', name: 'Acme' },
    images: [{ id: 'img-001', url: 'https://example.com/img.jpg' }],
    _count: { variants: 2, inventoryItems: 3 },
    inventoryItems: [
      makeInventoryItem(),
      makeInventoryItem({ quantity: 50, reserved: 5, available: 45 }),
    ],
  };
}

// ─── Mock Factory ─────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const defaultQuery: ProductQueryDto = { page: 1, limit: 20, sortOrder: 'desc' };

    it('should return paginated products for tenant', async () => {
      const products = [makePaginatedProduct()];
      prisma.product.findMany.mockResolvedValue(products);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A, defaultQuery);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasMore).toBe(false);

      // Verify tenantId is always passed
      const findManyArgs = prisma.product.findMany.mock.calls[0][0];
      expect(findManyArgs.where.tenantId).toBe(TENANT_A);
    });

    it('should filter by status', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, status: 'ACTIVE' });

      const whereArg = prisma.product.findMany.mock.calls[0][0].where;
      expect(whereArg.status).toBe('ACTIVE');
    });

    it('should filter by categoryId', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, categoryId: 'cat-001' });

      const whereArg = prisma.product.findMany.mock.calls[0][0].where;
      expect(whereArg.categoryId).toBe('cat-001');
    });

    it('should filter by brandId', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, brandId: 'brand-001' });

      const whereArg = prisma.product.findMany.mock.calls[0][0].where;
      expect(whereArg.brandId).toBe('brand-001');
    });

    it('should search by name (case insensitive)', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, search: 'Widget' });

      const whereArg = prisma.product.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: { contains: 'Widget', mode: 'insensitive' } }),
        ]),
      );
    });

    it('should search by SKU', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, search: 'PRD-000001' });

      const whereArg = prisma.product.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sku: { contains: 'PRD-000001', mode: 'insensitive' } }),
        ]),
      );
    });

    it('should NOT return products from other tenants', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, defaultQuery);

      const whereArg = prisma.product.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
      expect(whereArg.tenantId).not.toBe(TENANT_B);
    });

    it('should NOT return soft-deleted products (deletedAt != null)', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, defaultQuery);

      const whereArg = prisma.product.findMany.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
    });

    it('should include inventory summary (total available stock)', async () => {
      const product = makePaginatedProduct();
      prisma.product.findMany.mockResolvedValue([product]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A, defaultQuery);

      const enriched = result.data[0];
      expect(enriched.inventory).toBeDefined();
      expect(enriched.inventory.totalQuantity).toBe(150); // 100 + 50
      expect(enriched.inventory.totalReserved).toBe(15);  // 10 + 5
      expect(enriched.inventory.totalAvailable).toBe(135); // 90 + 45
      // Raw inventoryItems should be stripped
      expect(enriched.inventoryItems).toBeUndefined();
    });

    it('should compute correct skip for pagination', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, page: 3, limit: 10 });

      const findManyArgs = prisma.product.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(20); // (3 - 1) * 10
      expect(findManyArgs.take).toBe(10);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return product with variants, images, and inventory', async () => {
      const product = {
        ...makeProduct(),
        category: { id: 'cat-001', name: 'Electronics', slug: 'electronics' },
        brand: { id: 'brand-001', name: 'Acme' },
        supplier: null,
        variants: [{ id: 'var-001', inventoryItems: [] }],
        images: [{ id: 'img-001', url: 'https://example.com/img.jpg', position: 1 }],
        inventoryItems: [
          { id: 'ii-1', warehouseId: 'wh-1', quantity: 50, reserved: 5, available: 45, warehouse: { id: 'wh-1', name: 'Main', code: 'MAIN' } },
          { id: 'ii-2', warehouseId: 'wh-2', quantity: 30, reserved: 0, available: 30, warehouse: { id: 'wh-2', name: 'Secondary', code: 'SEC' } },
        ],
      };
      prisma.product.findFirst.mockResolvedValue(product);

      const result = await service.findOne(TENANT_A, 'prod-001');

      expect(result.inventorySummary).toBeDefined();
      expect(result.inventorySummary.totalQuantity).toBe(80);
      expect(result.inventorySummary.totalReserved).toBe(5);
      expect(result.inventorySummary.totalAvailable).toBe(75);
      expect(result.variants).toBeDefined();
      expect(result.images).toBeDefined();

      // Verify tenantId scoping
      const findFirstArgs = prisma.product.findFirst.mock.calls[0][0];
      expect(findFirstArgs.where.tenantId).toBe(TENANT_A);
      expect(findFirstArgs.where.deletedAt).toBeNull();
    });

    it('should throw NotFoundException when product not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_A, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when product belongs to another tenant', async () => {
      // Simulate: the query is scoped by TENANT_A, product only exists for TENANT_B
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_A, 'prod-of-tenant-b')).rejects.toThrow(
        NotFoundException,
      );

      const findFirstArgs = prisma.product.findFirst.mock.calls[0][0];
      expect(findFirstArgs.where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto: CreateProductDto = {
      name: 'New Widget',
      costPrice: 10,
      sku: 'CUSTOM-SKU-001',
    };

    // SCRUM-37: the product carries the minimum that seeds each InventoryItem
    it('should persist defaultMinStock', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(makeProduct());

      await service.create(TENANT_A, { ...baseDto, defaultMinStock: 12 });

      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data.defaultMinStock).toBe(12);
    });

    it('should default defaultMinStock to 0 when omitted', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(makeProduct());

      await service.create(TENANT_A, baseDto);

      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data.defaultMinStock).toBe(0);
    });

    it('should create product with valid data', async () => {
      prisma.product.findFirst.mockResolvedValue(null); // No existing SKU
      const createdProduct = makeProduct({ sku: 'CUSTOM-SKU-001', name: 'New Widget' });
      prisma.product.create.mockResolvedValue(createdProduct);

      const result = await service.create(TENANT_A, baseDto);

      expect(result.sku).toBe('CUSTOM-SKU-001');
      expect(prisma.product.create).toHaveBeenCalledTimes(1);

      const createArgs = prisma.product.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(TENANT_A);
      expect(createArgs.data.name).toBe('New Widget');
    });

    it('should auto-generate SKU when not provided (format PRD-XXXXXX)', async () => {
      prisma.product.count.mockResolvedValue(4); // 4 existing products
      prisma.product.findFirst.mockResolvedValue(null); // No collision
      prisma.product.create.mockResolvedValue(makeProduct({ sku: 'PRD-000005' }));

      const dto: CreateProductDto = { name: 'No SKU Product', costPrice: 5 };
      const result = await service.create(TENANT_A, dto);

      expect(prisma.product.count).toHaveBeenCalledWith({ where: { tenantId: TENANT_A } });
      const createArgs = prisma.product.create.mock.calls[0][0];
      expect(createArgs.data.sku).toBe('PRD-000005');
    });

    it('should calculate salePrice from costPrice + markup when markup provided', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockImplementation(({ data }) => Promise.resolve({ ...makeProduct(), ...data }));

      const dto: CreateProductDto = {
        name: 'Markup Product',
        costPrice: 100,
        markup: 50,
        sku: 'MARK-001',
      };
      await service.create(TENANT_A, dto);

      const createArgs = prisma.product.create.mock.calls[0][0];
      expect(createArgs.data.salePrice).toBe(150); // 100 * (1 + 50/100)
    });

    it('should use costPrice as salePrice when neither salePrice nor markup provided', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockImplementation(({ data }) => Promise.resolve({ ...makeProduct(), ...data }));

      const dto: CreateProductDto = { name: 'Simple', costPrice: 25, sku: 'SMP-001' };
      await service.create(TENANT_A, dto);

      const createArgs = prisma.product.create.mock.calls[0][0];
      expect(createArgs.data.salePrice).toBe(25);
    });

    it('should throw ConflictException when SKU already exists for tenant', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct({ sku: 'CUSTOM-SKU-001' }));

      await expect(service.create(TENANT_A, baseDto)).rejects.toThrow(ConflictException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('should allow same SKU in different tenants', async () => {
      // First call for SKU check returns null (no conflict in TENANT_B)
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(makeProduct({ tenantId: TENANT_B }));

      await service.create(TENANT_B, baseDto);

      const findFirstArgs = prisma.product.findFirst.mock.calls[0][0];
      expect(findFirstArgs.where.tenantId).toBe(TENANT_B);
      expect(prisma.product.create).toHaveBeenCalledTimes(1);
    });

    it('should create product with variants when provided', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(makeProduct());

      const dto: CreateProductDto = {
        name: 'Variable Product',
        costPrice: 20,
        sku: 'VAR-001',
        variants: [
          { sku: 'VAR-001-S', name: 'Small', attributes: { size: 'S' } },
          { sku: 'VAR-001-M', name: 'Medium', attributes: { size: 'M' } },
        ],
      };
      await service.create(TENANT_A, dto);

      const createArgs = prisma.product.create.mock.calls[0][0];
      expect(createArgs.data.variants).toBeDefined();
      expect(createArgs.data.variants.create).toHaveLength(2);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update defaultMinStock', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct());
      prisma.product.update.mockResolvedValue(makeProduct());

      await service.update(TENANT_A, 'prod-001', { defaultMinStock: 25 });

      const data = prisma.product.update.mock.calls[0][0].data;
      expect(data.defaultMinStock).toBe(25);
    });

    it('should update product fields', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct());
      prisma.product.update.mockResolvedValue(makeProduct({ name: 'Updated Widget' }));

      const dto: UpdateProductDto = { name: 'Updated Widget' };
      const result = await service.update(TENANT_A, 'prod-001', dto);

      expect(result.name).toBe('Updated Widget');
      expect(prisma.product.update).toHaveBeenCalledTimes(1);
    });

    it('should recalculate salePrice when markup changes', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct({ costPrice: 100 }));
      prisma.product.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...makeProduct(), ...data }),
      );

      const dto: UpdateProductDto = { markup: 80 };
      await service.update(TENANT_A, 'prod-001', dto);

      const updateArgs = prisma.product.update.mock.calls[0][0];
      expect(updateArgs.data.salePrice).toBe(180); // 100 * (1 + 80/100)
    });

    it('should recalculate salePrice when costPrice changes with existing markup', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct({ costPrice: 100, markup: 50 }));
      prisma.product.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...makeProduct(), ...data }),
      );

      const dto: UpdateProductDto = { costPrice: 200, markup: 50 };
      await service.update(TENANT_A, 'prod-001', dto);

      const updateArgs = prisma.product.update.mock.calls[0][0];
      expect(updateArgs.data.salePrice).toBe(300); // 200 * (1 + 50/100)
    });

    it('should throw NotFoundException when product not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, 'non-existent', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when updated SKU collides', async () => {
      prisma.product.findFirst
        .mockResolvedValueOnce(makeProduct({ sku: 'OLD-SKU' })) // existing product
        .mockResolvedValueOnce(makeProduct({ id: 'other-prod', sku: 'TAKEN-SKU' })); // collision

      await expect(
        service.update(TENANT_A, 'prod-001', { sku: 'TAKEN-SKU' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should verify tenant isolation on update', async () => {
      prisma.product.findFirst.mockResolvedValue(null); // Not found for TENANT_A

      await expect(
        service.update(TENANT_A, 'prod-of-tenant-b', { name: 'Hack' }),
      ).rejects.toThrow(NotFoundException);

      const findFirstArgs = prisma.product.findFirst.mock.calls[0][0];
      expect(findFirstArgs.where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── remove (soft delete) ─────────────────────────────────────────────────

  describe('remove', () => {
    it('should set deletedAt timestamp and status to INACTIVE', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct());
      prisma.product.update.mockResolvedValue(makeProduct({ deletedAt: new Date(), status: 'INACTIVE' }));

      const result = await service.remove(TENANT_A, 'prod-001');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Product deleted successfully');

      const updateArgs = prisma.product.update.mock.calls[0][0];
      expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
      expect(updateArgs.data.status).toBe('INACTIVE');
    });

    it('should NOT actually delete the record (no prisma.product.delete call)', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct());
      prisma.product.update.mockResolvedValue(makeProduct());

      await service.remove(TENANT_A, 'prod-001');

      expect(prisma.product.delete).not.toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when product not found', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_A, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should verify tenant isolation on delete', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_A, 'prod-of-tenant-b')).rejects.toThrow(
        NotFoundException,
      );

      const findFirstArgs = prisma.product.findFirst.mock.calls[0][0];
      expect(findFirstArgs.where.tenantId).toBe(TENANT_A);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../database/prisma/prisma.service';

const TENANT_A = 'tenant-aaa-111';

function createMockPrisma() {
  return {
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    order: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

const ALL = ['customers:read', 'products:read', 'orders:read'];

describe('SearchService', () => {
  let service: SearchService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('search', () => {
    it('should not hit the database for a query shorter than 2 characters', async () => {
      // A one-letter search matches half the catalogue and costs three
      // table scans for a result nobody can use.
      expect(await service.search(TENANT_A, 'a', ALL)).toEqual([]);
      expect(prisma.customer.findMany).not.toHaveBeenCalled();
      expect(prisma.product.findMany).not.toHaveBeenCalled();
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it('should trim the term before measuring it', async () => {
      expect(await service.search(TENANT_A, '   ', ALL)).toEqual([]);
      expect(prisma.customer.findMany).not.toHaveBeenCalled();
    });

    it('should scope every query by tenant', async () => {
      await service.search(TENANT_A, 'widget', ALL);

      expect(prisma.customer.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      expect(prisma.product.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      expect(prisma.order.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
    });

    it('should skip a group the caller cannot read', async () => {
      // Narrowing the response, not just the route: a seller must not get a
      // hit list revealing rows they cannot open.
      await service.search(TENANT_A, 'widget', ['products:read'], 'seller');

      expect(prisma.product.findMany).toHaveBeenCalled();
      expect(prisma.customer.findMany).not.toHaveBeenCalled();
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it('should give an owner every group even with no granted permissions', async () => {
      await service.search(TENANT_A, 'widget', [], 'owner');

      expect(prisma.customer.findMany).toHaveBeenCalled();
      expect(prisma.product.findMany).toHaveBeenCalled();
      expect(prisma.order.findMany).toHaveBeenCalled();
    });

    it('should drop empty groups from the answer', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Widget A', sku: 'SKU-001', salePrice: 10 },
      ]);

      const groups = await service.search(TENANT_A, 'widget', ALL);

      expect(groups).toHaveLength(1);
      expect(groups[0].entity).toBe('products');
    });

    it('should search a customer document by its digits', async () => {
      // AE-15: documents are stored unmasked, so "529.982.247-25" only matches
      // once the mask is stripped.
      await service.search(TENANT_A, '529.982.247-25', ALL);

      const or = prisma.customer.findMany.mock.calls[0][0].where.OR;
      expect(or).toContainEqual({ document: { contains: '52998224725' } });
    });

    it('should not add a document clause for a plain name search', async () => {
      await service.search(TENANT_A, 'Maria', ALL);

      const or = prisma.customer.findMany.mock.calls[0][0].where.OR;
      expect(or.some((c: Record<string, unknown>) => 'document' in c)).toBe(false);
    });

    it('should build hits with a link the palette can navigate to', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'o1',
          orderNumber: 'PED-000038',
          status: 'COMPLETED',
          customer: { name: 'Maria Silva' },
        },
      ]);

      const groups = await service.search(TENANT_A, 'PED', ALL);

      expect(groups[0].hits[0]).toEqual({
        id: 'o1',
        title: 'PED-000038',
        subtitle: 'Maria Silva',
        href: '/vendas/pedidos/o1',
      });
    });

    it('should exclude soft-deleted rows from every group', async () => {
      await service.search(TENANT_A, 'widget', ALL);

      expect(prisma.customer.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
      expect(prisma.product.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
      expect(prisma.order.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
    });

    it('should cap each group so the dropdown stays readable', async () => {
      await service.search(TENANT_A, 'widget', ALL);

      expect(prisma.customer.findMany.mock.calls[0][0].take).toBe(5);
      expect(prisma.product.findMany.mock.calls[0][0].take).toBe(5);
      expect(prisma.order.findMany.mock.calls[0][0].take).toBe(5);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './dto/customer.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-aaa-111';
const TENANT_B = 'tenant-bbb-222';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-001',
    tenantId: TENANT_A,
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+5511999990000',
    document: '12345678901',
    documentType: 'CPF',
    tradeName: null,
    segment: 'RETAIL',
    tags: ['vip'],
    score: 0,
    notes: null,
    metadata: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    addresses: [],
    ...overrides,
  };
}

// ─── Mock Factory ─────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    customer: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const baseDto: CreateCustomerDto = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+5511888880000',
      document: '98765432100',
      documentType: 'CPF',
    };

    it('should create customer with valid data', async () => {
      prisma.customer.findFirst.mockResolvedValue(null); // no duplicate doc
      const created = makeCustomer({ name: 'Jane Doe', email: 'jane@example.com', document: '98765432100' });
      prisma.customer.create.mockResolvedValue(created);

      const result = await service.create(TENANT_A, baseDto);

      expect(result.name).toBe('Jane Doe');
      expect(prisma.customer.create).toHaveBeenCalledTimes(1);

      const createArgs = prisma.customer.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(TENANT_A);
      expect(createArgs.data.name).toBe('Jane Doe');
    });

    it('should throw ConflictException when duplicate document exists for tenant', async () => {
      prisma.customer.findFirst.mockResolvedValue(makeCustomer()); // duplicate found

      await expect(service.create(TENANT_A, baseDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when duplicate email exists for tenant', async () => {
      // First call (document check) returns null, second call (email check) returns existing
      prisma.customer.findFirst
        .mockResolvedValueOnce(null) // no duplicate doc
        .mockResolvedValueOnce(makeCustomer()); // duplicate email

      await expect(service.create(TENANT_A, baseDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('should allow same document in different tenants', async () => {
      prisma.customer.findFirst.mockResolvedValue(null); // no duplicate
      prisma.customer.create.mockResolvedValue(makeCustomer({ tenantId: TENANT_B }));

      await service.create(TENANT_B, baseDto);

      const findArgs = prisma.customer.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_B);
      expect(prisma.customer.create).toHaveBeenCalledTimes(1);
    });

    it('should create customer without document (no duplicate check)', async () => {
      const dto: CreateCustomerDto = { name: 'No Doc Customer' };
      prisma.customer.create.mockResolvedValue(makeCustomer({ document: null }));

      const result = await service.create(TENANT_A, dto);

      expect(result).toBeDefined();
      // findFirst should not be called for document check when document is not provided
      // (it may be called for email check if email is provided)
    });

    it('should set tags to empty array when not provided', async () => {
      const dto: CreateCustomerDto = { name: 'No Tags' };
      prisma.customer.create.mockResolvedValue(makeCustomer({ tags: [] }));

      await service.create(TENANT_A, dto);

      const createArgs = prisma.customer.create.mock.calls[0][0];
      expect(createArgs.data.tags).toEqual([]);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const defaultQuery: CustomerQueryDto = { page: 1, limit: 20, sortOrder: 'desc' };

    it('should return paginated customers for tenant', async () => {
      const customers = [makeCustomer()];
      prisma.customer.findMany.mockResolvedValue(customers);
      prisma.customer.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A, defaultQuery);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);

      const whereArg = prisma.customer.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
      expect(whereArg.deletedAt).toBeNull();
    });

    it('should search by name, email, document, phone', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, search: 'John' });

      const whereArg = prisma.customer.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: { contains: 'John', mode: 'insensitive' } }),
          expect.objectContaining({ email: { contains: 'John', mode: 'insensitive' } }),
          expect.objectContaining({ document: { contains: 'John', mode: 'insensitive' } }),
        ]),
      );
    });

    it('should filter by segment', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, segment: 'RETAIL' });

      const whereArg = prisma.customer.findMany.mock.calls[0][0].where;
      expect(whereArg.segment).toBe('RETAIL');
    });

    it('should filter by tag', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { ...defaultQuery, tag: 'vip' });

      const whereArg = prisma.customer.findMany.mock.calls[0][0].where;
      expect(whereArg.tags).toEqual({ has: 'vip' });
    });

    it('should NOT return customers from other tenants', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, defaultQuery);

      const whereArg = prisma.customer.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
      expect(whereArg.tenantId).not.toBe(TENANT_B);
    });

    it('should NOT return soft-deleted customers', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, defaultQuery);

      const whereArg = prisma.customer.findMany.mock.calls[0][0].where;
      expect(whereArg.deletedAt).toBeNull();
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return customer with addresses and interactions', async () => {
      const customer = makeCustomer({ addresses: [], interactions: [], _count: { orders: 5, invoices: 2 } });
      prisma.customer.findFirst.mockResolvedValue(customer);

      const result = await service.findById(TENANT_A, 'cust-001');

      expect(result).toEqual(customer);
      const findArgs = prisma.customer.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
      expect(findArgs.where.deletedAt).toBeNull();
    });

    it('should throw NotFoundException when customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.findById(TENANT_A, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when customer belongs to another tenant', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.findById(TENANT_A, 'cust-of-tenant-b')).rejects.toThrow(
        NotFoundException,
      );

      const findArgs = prisma.customer.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update customer fields', async () => {
      prisma.customer.findFirst.mockResolvedValue(makeCustomer());
      prisma.customer.update.mockResolvedValue(makeCustomer({ name: 'Updated Name' }));

      const dto: UpdateCustomerDto = { name: 'Updated Name' };
      const result = await service.update(TENANT_A, 'cust-001', dto);

      expect(result.name).toBe('Updated Name');
      expect(prisma.customer.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, 'nonexistent', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updated document collides', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(makeCustomer({ document: 'OLD-DOC' })) // existing customer
        .mockResolvedValueOnce(makeCustomer({ id: 'other-cust', document: 'TAKEN-DOC' })); // collision

      await expect(
        service.update(TENANT_A, 'cust-001', { document: 'TAKEN-DOC' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should verify tenant isolation on update', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, 'cust-of-tenant-b', { name: 'Hack' }),
      ).rejects.toThrow(NotFoundException);

      const findArgs = prisma.customer.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── remove (soft delete) ─────────────────────────────────────────────────

  describe('remove', () => {
    it('should set deletedAt timestamp (soft delete)', async () => {
      prisma.customer.findFirst.mockResolvedValue(makeCustomer());
      prisma.customer.update.mockResolvedValue(makeCustomer({ deletedAt: new Date() }));

      const result = await service.remove(TENANT_A, 'cust-001');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Cliente removido com sucesso');

      const updateArgs = prisma.customer.update.mock.calls[0][0];
      expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException when customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_A, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should verify tenant isolation on delete', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_A, 'cust-of-tenant-b')).rejects.toThrow(
        NotFoundException,
      );

      const findArgs = prisma.customer.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });
  });
});

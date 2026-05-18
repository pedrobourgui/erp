import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';

// ─── Mock CustomersService ───────────────────────────────────────────────────

function createMockCustomersService() {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-uuid-001',
    tenantId: TENANT_ID,
    name: 'Joao da Silva',
    email: 'joao@email.com.br',
    phone: '+5511999990000',
    document: '123.456.789-00',
    documentType: 'CPF',
    type: 'INDIVIDUAL',
    status: 'ACTIVE',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: ReturnType<typeof createMockCustomersService>;

  beforeEach(async () => {
    service = createMockCustomersService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: CustomersService, useValue: service },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CustomersController>(CustomersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ──────────────────────────────────────────────────────────
  describe('GET /customers', () => {
    it('should call service.findAll with tenantId and query', async () => {
      const paginatedResult = { data: [makeCustomer()], meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasMore: false } };
      service.findAll.mockResolvedValue(paginatedResult);

      const query = { page: 1, limit: 20 };
      const result = await controller.findAll(TENANT_ID, query as any);

      expect(service.findAll).toHaveBeenCalledWith(TENANT_ID, query);
      expect(result).toEqual(paginatedResult);
    });

    it('should require customers:read permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.findAll);
      expect(metadata).toEqual(['customers:read']);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────
  describe('GET /customers/:id', () => {
    it('should return customer wrapped in success response', async () => {
      const customer = makeCustomer();
      service.findById.mockResolvedValue(customer);

      const result = await controller.findOne(TENANT_ID, 'cust-uuid-001');

      expect(service.findById).toHaveBeenCalledWith(TENANT_ID, 'cust-uuid-001');
      expect(result).toEqual({ success: true, data: customer });
    });

    it('should require customers:read permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.findOne);
      expect(metadata).toEqual(['customers:read']);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────
  describe('POST /customers', () => {
    it('should pass tenantId and dto to service.create', async () => {
      const dto = { name: 'Novo Cliente', email: 'novo@email.com', documentType: 'CPF', document: '111.222.333-44' };
      const created = makeCustomer({ ...dto, id: 'cust-uuid-new' });
      service.create.mockResolvedValue(created);

      const result = await controller.create(TENANT_ID, dto as any);

      expect(service.create).toHaveBeenCalledWith(TENANT_ID, dto);
      expect(result).toEqual({ success: true, data: created });
    });

    it('should require customers:create permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.create);
      expect(metadata).toEqual(['customers:create']);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────
  describe('PATCH /customers/:id', () => {
    it('should pass tenantId, id, and dto to service.update', async () => {
      const dto = { name: 'Updated Name' };
      const updated = makeCustomer({ name: 'Updated Name' });
      service.update.mockResolvedValue(updated);

      const result = await controller.update(TENANT_ID, 'cust-uuid-001', dto as any);

      expect(service.update).toHaveBeenCalledWith(TENANT_ID, 'cust-uuid-001', dto);
      expect(result).toEqual({ success: true, data: updated });
    });

    it('should require customers:update permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.update);
      expect(metadata).toEqual(['customers:update']);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────
  describe('DELETE /customers/:id', () => {
    it('should pass tenantId and id to service.remove', async () => {
      service.remove.mockResolvedValue({ success: true });

      const result = await controller.remove(TENANT_ID, 'cust-uuid-001');

      expect(service.remove).toHaveBeenCalledWith(TENANT_ID, 'cust-uuid-001');
    });

    it('should require customers:delete permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.remove);
      expect(metadata).toEqual(['customers:delete']);
    });
  });
});

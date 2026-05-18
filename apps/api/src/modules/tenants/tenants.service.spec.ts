import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedPasswordValue'),
}));

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-999';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: TENANT_ID,
    name: 'Empresa Teste LTDA',
    document: '12.345.678/0001-90',
    email: 'empresa@teste.com',
    phone: '+5511999990000',
    plan: 'PRO',
    status: 'ACTIVE',
    taxRegime: 'SIMPLES_NACIONAL',
    maxUsers: 10,
    maxProducts: 1000,
    maxOrders: 5000,
    maxWarehouses: 3,
    settings: { currency: 'BRL', timezone: 'America/Sao_Paulo', language: 'pt-BR' },
    addressStreet: 'Rua Teste',
    addressNumber: '123',
    addressComplement: null,
    addressNeighborhood: 'Centro',
    addressCity: 'São Paulo',
    addressState: 'SP',
    addressZipCode: '01000-000',
    trialEndsAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── Mock Factory ─────────────────────────────────────────────────────────────

function createMockPrisma() {
  const mockTx = {
    tenant: {
      create: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
    role: {
      create: jest.fn(),
    },
    rolePermission: {
      createMany: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
  };

  return {
    tenant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    _tx: mockTx,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return tenant data when found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());

      const result = await service.findById(TENANT_ID);

      expect(result.id).toBe(TENANT_ID);
      expect(result.name).toBe('Empresa Teste LTDA');
      expect(result.plan).toBe('PRO');
      expect(result.status).toBe('ACTIVE');
    });

    it('should return all expected fields', async () => {
      const tenant = makeTenant();
      prisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.findById(TENANT_ID);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('document');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('taxRegime');
      expect(result).toHaveProperty('maxUsers');
      expect(result).toHaveProperty('settings');
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should pass correct id to Prisma', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());

      await service.findById(TENANT_ID);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TENANT_ID },
        }),
      );
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const updateDto: UpdateTenantDto = {
      name: 'Updated Empresa',
      email: 'updated@teste.com',
    };

    it('should update tenant fields', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.tenant.update.mockResolvedValue(makeTenant({ name: 'Updated Empresa', email: 'updated@teste.com' }));

      const result = await service.update(TENANT_ID, updateDto);

      expect(result.name).toBe('Updated Empresa');
      expect(result.email).toBe('updated@teste.com');
      expect(prisma.tenant.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updated document collides with another tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.tenant.findFirst.mockResolvedValue(makeTenant({ id: OTHER_TENANT_ID })); // collision

      await expect(
        service.update(TENANT_ID, { document: '99.999.999/0001-99' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow update when document is not being changed', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.tenant.update.mockResolvedValue(makeTenant({ name: 'New Name' }));

      const result = await service.update(TENANT_ID, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      // findFirst should not have been called for document check when document is not in dto
      expect(prisma.tenant.findFirst).not.toHaveBeenCalled();
    });

    it('should update address fields', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.tenant.update.mockResolvedValue(makeTenant({
        addressStreet: 'Nova Rua',
        addressNumber: '456',
        addressCity: 'Rio de Janeiro',
        addressState: 'RJ',
      }));

      const dto: UpdateTenantDto = {
        addressStreet: 'Nova Rua',
        addressNumber: '456',
        addressCity: 'Rio de Janeiro',
        addressState: 'RJ',
      };
      const result = await service.update(TENANT_ID, dto);

      expect(result.addressStreet).toBe('Nova Rua');
      expect(result.addressCity).toBe('Rio de Janeiro');
    });

    it('should update taxRegime', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.tenant.update.mockResolvedValue(makeTenant({ taxRegime: 'LUCRO_PRESUMIDO' }));

      const result = await service.update(TENANT_ID, { taxRegime: 'LUCRO_PRESUMIDO' });

      expect(result.taxRegime).toBe('LUCRO_PRESUMIDO');
    });
  });

  // ─── findByDocument ───────────────────────────────────────────────────────

  describe('findByDocument', () => {
    it('should return tenant when found by document', async () => {
      prisma.tenant.findFirst.mockResolvedValue(makeTenant());

      const result = await service.findByDocument('12.345.678/0001-90');

      expect(result.id).toBe(TENANT_ID);
      expect(result.document).toBe('12.345.678/0001-90');
    });

    it('should throw NotFoundException when not found by document', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.findByDocument('00.000.000/0000-00'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should exclude soft-deleted tenants', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);

      await service.findByDocument('12.345.678/0001-90').catch(() => {});

      const findArgs = prisma.tenant.findFirst.mock.calls[0][0];
      expect(findArgs.where.deletedAt).toBeNull();
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const createData = {
      name: 'New Company',
      document: '99.999.999/0001-99',
      email: 'new@company.com',
      adminName: 'Admin',
      adminEmail: 'admin@company.com',
      adminPassword: 'S3cur3P@ss',
    };

    it('should create tenant with default roles and admin user', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null); // no duplicate

      const tx = prisma._tx;
      tx.tenant.create.mockResolvedValue({
        id: 'new-tenant-001',
        name: 'New Company',
        document: '99.999.999/0001-99',
        plan: 'TRIAL',
        status: 'ACTIVE',
      });
      tx.permission.findMany.mockResolvedValue([
        { id: 'perm-001', resource: 'products', action: 'create' },
        { id: 'perm-002', resource: 'products', action: 'read' },
      ]);
      tx.role.create.mockResolvedValue({ id: 'role-new-001' });
      tx.rolePermission.createMany.mockResolvedValue({ count: 2 });
      tx.user.create.mockResolvedValue({
        id: 'user-new-001',
        email: 'admin@company.com',
        name: 'Admin',
        roleId: 'role-new-001',
      });

      const result = await service.create(createData);

      expect(result.tenant.name).toBe('New Company');
      expect(result.tenant.plan).toBe('TRIAL');
      expect(result.user.email).toBe('admin@company.com');
    });

    it('should throw ConflictException when duplicate document exists', async () => {
      prisma.tenant.findFirst.mockResolvedValue(makeTenant()); // duplicate

      await expect(service.create(createData)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should set plan to TRIAL on creation', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);

      const tx = prisma._tx;
      tx.tenant.create.mockResolvedValue({
        id: 'new-tenant-001',
        name: 'New Company',
        document: '99.999.999/0001-99',
        plan: 'TRIAL',
        status: 'ACTIVE',
      });
      tx.permission.findMany.mockResolvedValue([]);
      tx.role.create.mockResolvedValue({ id: 'role-new-001' });
      tx.user.create.mockResolvedValue({
        id: 'user-new-001',
        email: 'admin@company.com',
        name: 'Admin',
        roleId: 'role-new-001',
      });

      const result = await service.create(createData);

      const tenantCreateData = tx.tenant.create.mock.calls[0][0].data;
      expect(tenantCreateData.plan).toBe('TRIAL');
      expect(tenantCreateData.status).toBe('ACTIVE');
      expect(tenantCreateData.trialEndsAt).toBeInstanceOf(Date);
    });

    it('should create default system roles', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);

      const tx = prisma._tx;
      tx.tenant.create.mockResolvedValue({
        id: 'new-tenant-001',
        name: 'New Company',
        document: '99.999.999/0001-99',
        plan: 'TRIAL',
        status: 'ACTIVE',
      });
      tx.permission.findMany.mockResolvedValue([]);
      tx.role.create.mockResolvedValue({ id: 'role-new-001' });
      tx.user.create.mockResolvedValue({
        id: 'user-new-001',
        email: 'admin@company.com',
        name: 'Admin',
        roleId: 'role-new-001',
      });

      await service.create(createData);

      // Should create 4 default roles: admin, manager, operator, viewer
      expect(tx.role.create).toHaveBeenCalledTimes(4);
      const roleNames = tx.role.create.mock.calls.map(
        (call: Array<Record<string, unknown>>) => (call[0] as Record<string, Record<string, unknown>>).data.name,
      );
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('manager');
      expect(roleNames).toContain('operator');
      expect(roleNames).toContain('viewer');
    });

    it('should hash admin password before storing', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null);

      const tx = prisma._tx;
      tx.tenant.create.mockResolvedValue({
        id: 'new-tenant-001',
        name: 'New Company',
        document: '99.999.999/0001-99',
        plan: 'TRIAL',
        status: 'ACTIVE',
      });
      tx.permission.findMany.mockResolvedValue([]);
      tx.role.create.mockResolvedValue({ id: 'role-new-001' });
      tx.user.create.mockResolvedValue({
        id: 'user-new-001',
        email: 'admin@company.com',
        name: 'Admin',
        roleId: 'role-new-001',
      });

      await service.create(createData);

      const userCreateData = tx.user.create.mock.calls[0][0].data;
      expect(userCreateData.password).toBe('$2b$12$hashedPasswordValue');
      expect(userCreateData.password).not.toBe('S3cur3P@ss');
    });
  });
});

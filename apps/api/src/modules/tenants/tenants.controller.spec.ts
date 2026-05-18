import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';

// ─── Mock TenantsService ─────────────────────────────────────────────────────

function createMockTenantsService() {
  return {
    findById: jest.fn(),
    update: jest.fn(),
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';

function makeTenant() {
  return {
    id: TENANT_ID,
    name: 'Empresa Teste LTDA',
    slug: 'empresa-teste',
    cnpj: '12.345.678/0001-99',
    plan: 'PRO',
    status: 'ACTIVE',
    email: 'contato@empresa.com.br',
    phone: '+5511999990000',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TenantsController', () => {
  let controller: TenantsController;
  let service: ReturnType<typeof createMockTenantsService>;

  beforeEach(async () => {
    service = createMockTenantsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        { provide: TenantsService, useValue: service },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getCurrent ───────────────────────────────────────────────────────
  describe('GET /tenants/current', () => {
    it('should return current tenant info wrapped in success response', async () => {
      const tenant = makeTenant();
      service.findById.mockResolvedValue(tenant);

      const result = await controller.getCurrent(TENANT_ID);

      expect(service.findById).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toEqual({ success: true, data: tenant });
    });

    it('should NOT require a specific permission (any authenticated user can view)', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.getCurrent);
      expect(metadata).toBeUndefined();
    });
  });

  // ─── updateCurrent ────────────────────────────────────────────────────
  describe('PATCH /tenants/current', () => {
    it('should pass tenantId and dto to service.update', async () => {
      const dto = { name: 'New Name LTDA', phone: '+5511888880000' };
      const updated = { ...makeTenant(), ...dto };
      service.update.mockResolvedValue(updated);

      const result = await controller.updateCurrent(TENANT_ID, dto as any);

      expect(service.update).toHaveBeenCalledWith(TENANT_ID, dto);
      expect(result).toEqual({ success: true, data: updated });
    });

    it('should require settings:update permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.updateCurrent);
      expect(metadata).toEqual(['settings:update']);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';

// ─── Mock UsersService ───────────────────────────────────────────────────────

function createMockUsersService() {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    invite: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';

function makeUser() {
  return {
    id: 'user-uuid-001',
    email: 'admin@empresa.com.br',
    name: 'Admin User',
    tenantId: TENANT_ID,
    roleId: 'role-uuid-001',
    status: 'ACTIVE',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UsersController', () => {
  let controller: UsersController;
  let service: ReturnType<typeof createMockUsersService>;

  beforeEach(async () => {
    service = createMockUsersService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: service },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ──────────────────────────────────────────────────────────
  describe('GET /users', () => {
    it('should call service.findAll with tenantId and pagination', async () => {
      const paginatedResult = { data: [makeUser()], meta: { total: 1, page: 1, limit: 20 } };
      service.findAll.mockResolvedValue(paginatedResult);

      const pagination = { page: 1, limit: 20 };
      const result = await controller.findAll(TENANT_ID, pagination as any);

      expect(service.findAll).toHaveBeenCalledWith(TENANT_ID, { page: 1, limit: 20 });
      expect(result).toEqual({ success: true, ...paginatedResult });
    });

    it('should default page to 1 and limit to 20 when not provided', async () => {
      const paginatedResult = { data: [], meta: { total: 0, page: 1, limit: 20 } };
      service.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(TENANT_ID, {} as any);

      expect(service.findAll).toHaveBeenCalledWith(TENANT_ID, { page: 1, limit: 20 });
    });

    it('should require users:read permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.findAll);
      expect(metadata).toEqual(['users:read']);
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────
  describe('GET /users/:id', () => {
    it('should return user wrapped in success response', async () => {
      const user = makeUser();
      service.findById.mockResolvedValue(user);

      const result = await controller.findById(TENANT_ID, 'user-uuid-001');

      expect(service.findById).toHaveBeenCalledWith(TENANT_ID, 'user-uuid-001');
      expect(result).toEqual({ success: true, data: user });
    });

    it('should require users:read permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.findById);
      expect(metadata).toEqual(['users:read']);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────
  describe('POST /users', () => {
    it('should pass tenantId and dto to service.create', async () => {
      const dto = { email: 'novo@empresa.com', name: 'Novo', password: 'Pass123!', roleId: 'role-001' };
      const created = makeUser();
      service.create.mockResolvedValue(created);

      const result = await controller.create(TENANT_ID, dto as any);

      expect(service.create).toHaveBeenCalledWith(TENANT_ID, dto);
      expect(result).toEqual({ success: true, data: created });
    });

    it('should require users:create permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.create);
      expect(metadata).toEqual(['users:create']);
    });
  });

  // ─── invite ───────────────────────────────────────────────────────────
  describe('POST /users/invite', () => {
    it('should pass tenantId and dto to service.invite', async () => {
      const dto = { email: 'invite@empresa.com', roleId: 'role-001' };
      const inviteResult = { message: 'Invite sent' };
      service.invite.mockResolvedValue(inviteResult);

      const result = await controller.invite(TENANT_ID, dto as any);

      expect(service.invite).toHaveBeenCalledWith(TENANT_ID, dto);
      expect(result).toEqual({ success: true, data: inviteResult });
    });

    it('should require users:create permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.invite);
      expect(metadata).toEqual(['users:create']);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────
  describe('PATCH /users/:id', () => {
    it('should pass tenantId, id, and dto to service.update', async () => {
      const dto = { name: 'Updated Name' };
      const updated = { ...makeUser(), name: 'Updated Name' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(TENANT_ID, 'user-uuid-001', dto as any);

      expect(service.update).toHaveBeenCalledWith(TENANT_ID, 'user-uuid-001', dto);
      expect(result).toEqual({ success: true, data: updated });
    });

    it('should require users:update permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.update);
      expect(metadata).toEqual(['users:update']);
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────
  describe('DELETE /users/:id', () => {
    it('should call service.delete with tenantId and id', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(TENANT_ID, 'user-uuid-001');

      expect(service.delete).toHaveBeenCalledWith(TENANT_ID, 'user-uuid-001');
    });

    it('should require users:delete permission', () => {
      const metadata = Reflect.getMetadata(PERMISSIONS_KEY, controller.delete);
      expect(metadata).toEqual(['users:delete']);
    });
  });
});

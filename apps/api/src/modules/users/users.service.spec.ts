import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import { InviteUserDto, CreateUserDto } from './dto/user.dto';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedPasswordValue'),
}));

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-aaa-111';
const TENANT_B = 'tenant-bbb-222';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    tenantId: TENANT_A,
    name: 'Test User',
    email: 'user@example.com',
    phone: '+5511999990000',
    status: 'ACTIVE',
    avatar: null,
    lastLoginAt: null,
    roleId: 'role-001',
    role: { id: 'role-001', name: 'Admin' },
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
    },
  };
}

function createMockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    client: {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(900),
    },
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    redis = createMockRedis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated users for tenant', async () => {
      const users = [makeUser()];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);

      const whereArg = prisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
      expect(whereArg.deletedAt).toBeNull();
    });

    it('should NOT return users from other tenants', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(TENANT_A, { page: 1, limit: 20 });

      const whereArg = prisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.tenantId).toBe(TENANT_A);
      expect(whereArg.tenantId).not.toBe(TENANT_B);
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return user with role and permissions', async () => {
      const user = makeUser();
      prisma.user.findFirst.mockResolvedValue(user);

      const result = await service.findById(TENANT_A, 'user-001');

      expect(result).toEqual(user);
      const findArgs = prisma.user.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findById(TENANT_A, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should verify tenant isolation', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findById(TENANT_A, 'user-of-tenant-b')).rejects.toThrow(
        NotFoundException,
      );

      const findArgs = prisma.user.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateUserDto = {
      name: 'New User',
      email: 'newuser@example.com',
      password: 'S3cur3P@ss',
    };

    it('should create user with valid data', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // no duplicate
      prisma.user.create.mockResolvedValue(makeUser({ name: 'New User', email: 'newuser@example.com' }));

      const result = await service.create(TENANT_A, dto);

      expect(result.name).toBe('New User');
      expect(prisma.user.create).toHaveBeenCalledTimes(1);

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(TENANT_A);
    });

    it('should throw ConflictException when duplicate email exists for tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser()); // duplicate found

      await expect(service.create(TENANT_A, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should hash password before storing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(makeUser());

      await service.create(TENANT_A, dto);

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.password).toBe('$2b$12$hashedPasswordValue');
      expect(createArgs.data.password).not.toBe('S3cur3P@ss');
    });
  });

  // ─── invite ───────────────────────────────────────────────────────────────

  describe('invite', () => {
    const inviteDto: InviteUserDto = {
      email: 'invited@example.com',
      roleId: 'role-001',
    };

    it('should invite user when under maxUsers limit', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 10 });
      prisma.user.count.mockResolvedValue(5); // 5 of 10 used
      prisma.user.findFirst.mockResolvedValue(null); // no duplicate
      prisma.role.findFirst.mockResolvedValue({ id: 'role-001', name: 'Admin' });

      const result = await service.invite(TENANT_A, inviteDto);

      expect(result.email).toBe('invited@example.com');
      expect(result.roleId).toBe('role-001');
      expect(result.roleName).toBe('Admin');
      expect(result.token).toBeDefined();
      expect(result.expiresIn).toBe(48 * 60 * 60);
    });

    it('should store invite token in Redis with 48h TTL', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 10 });
      prisma.user.count.mockResolvedValue(5);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.role.findFirst.mockResolvedValue({ id: 'role-001', name: 'Admin' });

      const result = await service.invite(TENANT_A, inviteDto);

      expect(redis.set).toHaveBeenCalledWith(
        `invite:${result.token}`,
        expect.stringContaining(inviteDto.email),
        48 * 60 * 60,
      );
    });

    it('should throw ForbiddenException when maxUsers limit reached', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 5 });
      prisma.user.count.mockResolvedValue(5); // at limit

      await expect(service.invite(TENANT_A, inviteDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when maxUsers limit exceeded', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 3 });
      prisma.user.count.mockResolvedValue(5); // over limit

      await expect(service.invite(TENANT_A, inviteDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when email already exists for tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 10 });
      prisma.user.count.mockResolvedValue(3);
      prisma.user.findFirst.mockResolvedValue(makeUser()); // duplicate

      await expect(service.invite(TENANT_A, inviteDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when role not found for tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 10 });
      prisma.user.count.mockResolvedValue(3);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.role.findFirst.mockResolvedValue(null); // role not found

      await expect(service.invite(TENANT_A, inviteDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.invite(TENANT_A, inviteDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should scope user count and lookup by tenantId', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ maxUsers: 10 });
      prisma.user.count.mockResolvedValue(3);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.role.findFirst.mockResolvedValue({ id: 'role-001', name: 'Admin' });

      await service.invite(TENANT_A, inviteDto);

      // User count scoped by tenant
      expect(prisma.user.count.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      // User lookup scoped by tenant
      expect(prisma.user.findFirst.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
      // Role lookup scoped by tenant
      expect(prisma.role.findFirst.mock.calls[0][0].where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update user fields', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ name: 'Updated Name' }));

      const result = await service.update(TENANT_A, 'user-001', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, 'nonexistent', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updated email collides', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(makeUser({ email: 'old@example.com' })) // existing user
        .mockResolvedValueOnce(makeUser({ id: 'other-user', email: 'taken@example.com' })); // collision

      await expect(
        service.update(TENANT_A, 'user-001', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should verify tenant isolation on update', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, 'user-of-tenant-b', { name: 'Hack' }),
      ).rejects.toThrow(NotFoundException);

      const findArgs = prisma.user.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should soft delete user (set deletedAt and status INACTIVE)', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ deletedAt: new Date(), status: 'INACTIVE' }));

      await service.delete(TENANT_A, 'user-001');

      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
      expect(updateArgs.data.status).toBe('INACTIVE');
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.delete(TENANT_A, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should verify tenant isolation on delete', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.delete(TENANT_A, 'user-of-tenant-b')).rejects.toThrow(
        NotFoundException,
      );

      const findArgs = prisma.user.findFirst.mock.calls[0][0];
      expect(findArgs.where.tenantId).toBe(TENANT_A);
    });
  });
});

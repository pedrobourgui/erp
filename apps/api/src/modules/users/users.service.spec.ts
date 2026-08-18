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
import { StorageService } from '../storage/storage.service';
import { InviteUserDto, CreateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedPasswordValue'),
  compare: jest.fn().mockResolvedValue(true),
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
      findMany: jest.fn(),
    },
  };
}

function createMockStorage() {
  return {
    uploadBuffer: jest
      .fn()
      .mockResolvedValue({ key: 'avatars/x.png', url: 'http://minio/erp-files/avatars/x.png' }),
    getObjectBuffer: jest.fn(),
    removeObject: jest.fn(),
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
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    storage = createMockStorage();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: StorageService, useValue: storage },
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

  // ─── self-service profile (SCRUM-23) ────────────────────────────────────

  describe('updateOwnProfile', () => {
    it('should update own cadastral data scoped to the authenticated user', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ name: 'Novo Nome' }));

      const result = await service.updateOwnProfile(TENANT_A, 'user-001', {
        name: 'Novo Nome',
      });

      expect(result.name).toBe('Novo Nome');
      const findArgs = prisma.user.findFirst.mock.calls[0][0];
      expect(findArgs.where).toMatchObject({ id: 'user-001', tenantId: TENANT_A });
      expect(prisma.user.update.mock.calls[0][0].where).toEqual({ id: 'user-001' });
    });

    it('should reject an email already used by another user', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(makeUser({ email: 'old@example.com' }))
        .mockResolvedValueOnce(makeUser({ id: 'other', email: 'taken@example.com' }));

      await expect(
        service.updateOwnProfile(TENANT_A, 'user-001', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFound when the user does not belong to the tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateOwnProfile(TENANT_A, 'user-001', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changeOwnPassword', () => {
    const dto = { currentPassword: 'atual123', newPassword: 'nova12345' };

    it('should hash and store the new password when the current one matches', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-001', password: 'hash-atual' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await service.changeOwnPassword(TENANT_A, 'user-001', dto);

      expect(bcrypt.compare).toHaveBeenCalledWith('atual123', 'hash-atual');
      expect(prisma.user.update.mock.calls[0][0].data.password).toBe(
        '$2b$12$hashedPasswordValue',
      );
    });

    it('should reject when the current password is wrong', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-001', password: 'hash-atual' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.changeOwnPassword(TENANT_A, 'user-001', dto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject when the new password equals the current one', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-001', password: 'hash-atual' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await expect(
        service.changeOwnPassword(TENANT_A, 'user-001', {
          currentPassword: 'same123',
          newPassword: 'same123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateOwnAvatar', () => {
    const file = {
      originalname: 'foto.png',
      buffer: Buffer.from('img'),
      mimetype: 'image/png',
      size: 1234,
    };

    it('should upload the avatar and persist its URL', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-001' });
      prisma.user.update.mockResolvedValue(
        makeUser({ avatar: 'http://minio/erp-files/avatars/x.png' }),
      );

      const result = await service.updateOwnAvatar(TENANT_A, 'user-001', file);

      expect(storage.uploadBuffer).toHaveBeenCalledTimes(1);
      expect(prisma.user.update.mock.calls[0][0].data.avatar).toBe(
        'http://minio/erp-files/avatars/x.png',
      );
      expect(result.avatar).toBe('http://minio/erp-files/avatars/x.png');
    });

    it('should reject a non-image file', async () => {
      await expect(
        service.updateOwnAvatar(TENANT_A, 'user-001', {
          ...file,
          mimetype: 'text/csv',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.uploadBuffer).not.toHaveBeenCalled();
    });

    it('should reject when no file is provided', async () => {
      await expect(
        service.updateOwnAvatar(TENANT_A, 'user-001', undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findRoles (FN-08) ────────────────────────────────────────────────────

  describe('findRoles', () => {
    it('should list the roles of the tenant with their user count', async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          id: 'role-001',
          name: 'owner',
          description: 'Proprietário',
          _count: { users: 1 },
        },
      ]);

      const result = await service.findRoles(TENANT_A);

      expect(result).toEqual([
        {
          id: 'role-001',
          name: 'owner',
          label: 'Proprietário',
          description: 'Proprietário',
          userCount: 1,
        },
      ]);
    });

    it('should scope the query by tenant', async () => {
      prisma.role.findMany.mockResolvedValue([]);

      await service.findRoles(TENANT_A);

      expect(prisma.role.findMany.mock.calls[0][0].where).toEqual({
        tenantId: TENANT_A,
      });
    });

    it('should not leak the permission rows of each role', async () => {
      prisma.role.findMany.mockResolvedValue([
        { id: 'r', name: 'seller', description: null, _count: { users: 0 } },
      ]);

      const result = await service.findRoles(TENANT_A);

      expect(result[0]).not.toHaveProperty('permissions');
      // A role with no description still renders a readable label.
      expect(result[0].label).toBe('Vendedor');
    });
  });
});

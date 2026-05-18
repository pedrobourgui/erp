import { Test, TestingModule } from '@nestjs/testing';
import { Provider } from '@nestjs/common';

// ─── Mock User Factory ────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
  name: string;
  password: string;
  avatar: string | null;
  phone: string | null;
  status: string;
  tenantId: string;
  roleId: string | null;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
  role: {
    id: string;
    name: string;
    permissions?: Array<{
      permission: { resource: string; action: string };
    }>;
  } | null;
  tenant: {
    id: string;
    name: string;
    plan: string;
    status: string;
  };
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'user-uuid-001',
    email: 'admin@empresa.com',
    name: 'Admin User',
    password: '$2b$10$hashedPasswordValue', // bcrypt hash placeholder
    avatar: null,
    phone: '+5511999990000',
    status: 'ACTIVE',
    tenantId: 'tenant-uuid-001',
    roleId: 'role-uuid-001',
    lastLoginAt: null,
    deletedAt: null,
    role: {
      id: 'role-uuid-001',
      name: 'Admin',
      permissions: [
        { permission: { resource: 'products', action: 'create' } },
        { permission: { resource: 'products', action: 'read' } },
        { permission: { resource: 'orders', action: 'read' } },
      ],
    },
    tenant: {
      id: 'tenant-uuid-001',
      name: 'Empresa Teste LTDA',
      plan: 'PRO',
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

// ─── Mock Tenant Factory ──────────────────────────────────────────────────────

export interface MockTenant {
  id: string;
  name: string;
  plan: string;
  status: string;
}

export function createMockTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: 'tenant-uuid-001',
    name: 'Empresa Teste LTDA',
    plan: 'PRO',
    status: 'ACTIVE',
    ...overrides,
  };
}

// ─── Mock PrismaService ──────────────────────────────────────────────────────

export function createMockPrismaService() {
  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    rolePermission: {
      findMany: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    forTenant: jest.fn().mockReturnThis(),
  };
}

// ─── Mock RedisService ───────────────────────────────────────────────────────

export function createMockRedisService() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    setAdd: jest.fn().mockResolvedValue(undefined),
    setIsMember: jest.fn().mockResolvedValue(false),
    client: {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(900),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
    },
  };
}

// ─── Testing Module Helper ───────────────────────────────────────────────────

export async function createTestingModule(
  providers: Provider[],
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers,
  }).compile();
}

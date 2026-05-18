/**
 * Factory for building User test data with Brazilian defaults.
 */
export interface FactoryUser {
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
  createdAt: Date;
  updatedAt: Date;
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

let userSeq = 0;

export function buildUser(overrides: Partial<FactoryUser> = {}): FactoryUser {
  userSeq++;
  const seq = String(userSeq).padStart(3, '0');
  const tenantId = overrides.tenantId ?? 'tenant-uuid-001';

  return {
    id: `user-uuid-${seq}`,
    email: `usuario${seq}@empresa.com.br`,
    name: `Usuario Teste ${seq}`,
    password: '$2b$10$hashedPasswordPlaceholder',
    avatar: null,
    phone: `+55119${seq.repeat(3).slice(0, 8)}`,
    status: 'ACTIVE',
    tenantId,
    roleId: `role-uuid-${seq}`,
    lastLoginAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    role: {
      id: `role-uuid-${seq}`,
      name: 'Admin',
      permissions: [
        { permission: { resource: 'products', action: 'create' } },
        { permission: { resource: 'products', action: 'read' } },
        { permission: { resource: 'orders', action: 'read' } },
      ],
    },
    tenant: {
      id: tenantId,
      name: 'Empresa Teste LTDA',
      plan: 'PRO',
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

export function resetUserSeq(): void {
  userSeq = 0;
}

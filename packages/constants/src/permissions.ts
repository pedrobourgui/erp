/**
 * Single source of truth for the permission matrix.
 *
 * Before this file the matrix existed twice, with different contents: the seed
 * (`apps/api/src/database/prisma/seed.ts`) wrote `resource:action` rows the
 * `PermissionsGuard` reads from the database, while `@erp/constants` exported a
 * different, invented list (`roles:create`, `warehouses:read`,
 * `reports:financial`) that nothing consumed. Any frontend gating built on the
 * constants list would have checked permissions that can never exist — the UI
 * would hide features from users who do have access.
 *
 * The list below is the real one: it is what the seed writes and what the
 * controllers require. Import it — never retype it.
 */

// ─── Permission names ──────────────────────────────────────────────────

export const PERMISSIONS = [
  // Products
  'products:create',
  'products:read',
  'products:update',
  'products:delete',
  'products:export',
  // Orders
  'orders:create',
  'orders:read',
  'orders:update',
  'orders:delete',
  'orders:export',
  // Inventory
  'inventory:create',
  'inventory:read',
  'inventory:update',
  'inventory:delete',
  'inventory:export',
  // Movements that are not a plain entry/exit: a transfer moves stock between
  // warehouses and an adjustment rewrites a balance with no document behind it.
  // Both deserve their own grant instead of riding on `inventory:create`.
  'inventory:transfer',
  'inventory:adjust',
  // Financial
  'financial:create',
  'financial:read',
  'financial:update',
  'financial:delete',
  'financial:export',
  // Customers
  'customers:create',
  'customers:read',
  'customers:update',
  'customers:delete',
  'customers:export',
  // Reports
  'reports:read',
  'reports:export',
  // Settings
  'settings:read',
  'settings:update',
  // Users
  'users:create',
  'users:read',
  'users:update',
  'users:delete',
  // Fiscal
  'fiscal:create',
  'fiscal:read',
  'fiscal:update',
  'fiscal:delete',
  'fiscal:export',
  // Purchases
  'purchases:create',
  'purchases:read',
  'purchases:update',
  'purchases:delete',
  'purchases:export',
  // Marketplace
  'marketplace:create',
  'marketplace:read',
  'marketplace:update',
  'marketplace:delete',
  // Point of sale — granular reads so selling does not require `financial:read`
  'payment-methods:read',
  'payment-conditions:read',
  'cash-registers:read-session',
] as const;

export type PermissionName = (typeof PERMISSIONS)[number];

/** Human-readable description, written to the `Permission` table by the seed. */
export const PERMISSION_DESCRIPTIONS: Record<PermissionName, string> = {
  'products:create': 'Criar produtos',
  'products:read': 'Visualizar produtos',
  'products:update': 'Editar produtos',
  'products:delete': 'Excluir produtos',
  'products:export': 'Exportar produtos',
  'orders:create': 'Criar pedidos',
  'orders:read': 'Visualizar pedidos',
  'orders:update': 'Editar pedidos',
  'orders:delete': 'Cancelar pedidos',
  'orders:export': 'Exportar pedidos',
  'inventory:create': 'Criar movimentações de estoque',
  'inventory:read': 'Visualizar estoque',
  'inventory:update': 'Ajustar estoque',
  'inventory:delete': 'Excluir movimentações',
  'inventory:export': 'Exportar estoque',
  'inventory:transfer': 'Transferir estoque entre depósitos',
  'inventory:adjust': 'Ajustar saldo de estoque por inventário',
  'financial:create': 'Criar lançamentos financeiros',
  'financial:read': 'Visualizar financeiro',
  'financial:update': 'Editar lançamentos financeiros',
  'financial:delete': 'Excluir lançamentos financeiros',
  'financial:export': 'Exportar financeiro',
  'customers:create': 'Criar clientes',
  'customers:read': 'Visualizar clientes',
  'customers:update': 'Editar clientes',
  'customers:delete': 'Excluir clientes',
  'customers:export': 'Exportar clientes',
  'reports:read': 'Visualizar relatórios',
  'reports:export': 'Exportar relatórios',
  'settings:read': 'Visualizar configurações',
  'settings:update': 'Editar configurações',
  'users:create': 'Criar usuários',
  'users:read': 'Visualizar usuários',
  'users:update': 'Editar usuários',
  'users:delete': 'Excluir usuários',
  'fiscal:create': 'Emitir notas fiscais',
  'fiscal:read': 'Visualizar notas fiscais',
  'fiscal:update': 'Editar notas fiscais',
  'fiscal:delete': 'Cancelar notas fiscais',
  'fiscal:export': 'Exportar notas fiscais',
  'purchases:create': 'Criar ordens de compra',
  'purchases:read': 'Visualizar compras',
  'purchases:update': 'Editar compras',
  'purchases:delete': 'Excluir compras',
  'purchases:export': 'Exportar compras',
  'marketplace:create': 'Criar conexões de marketplace',
  'marketplace:read': 'Visualizar marketplace',
  'marketplace:update': 'Editar marketplace',
  'marketplace:delete': 'Excluir conexões de marketplace',
  'payment-methods:read': 'Visualizar formas de pagamento',
  'payment-conditions:read': 'Visualizar condições de pagamento',
  'cash-registers:read-session': 'Consultar a sessão de caixa aberta',
};

export interface PermissionParts {
  resource: string;
  action: string;
}

/**
 * Splits `"cash-registers:read-session"` into resource and action.
 * Only the **first** colon separates them — actions may contain hyphens.
 */
export function parsePermission(name: string): PermissionParts {
  const separator = name.indexOf(':');
  if (separator === -1) return { resource: name, action: '' };
  return {
    resource: name.slice(0, separator),
    action: name.slice(separator + 1),
  };
}

/** Every permission as `{ resource, action, description }` — the seed's shape. */
export const PERMISSION_DEFINITIONS: (PermissionParts & {
  description: string;
})[] = PERMISSIONS.map((name) => ({
  ...parsePermission(name),
  description: PERMISSION_DESCRIPTIONS[name],
}));

// ─── Roles ─────────────────────────────────────────────────────────────

export interface RoleDefinition {
  name: string;
  description: string;
  /** Which permissions this role gets. Receives the parsed permission. */
  grants: (permission: PermissionParts) => boolean;
}

/**
 * Roles created by the seed for every tenant.
 *
 * `seller` is the role behind VD-07: it could create orders but not read the
 * payment methods, payment conditions or the open cash session the point of
 * sale needs, so the seller literally could not sell. Those three reads are
 * granular on purpose — a seller still cannot read the financial module.
 */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: 'owner',
    description: 'Proprietário – acesso total ao sistema',
    grants: () => true,
  },
  {
    name: 'admin',
    description: 'Administrador – acesso total ao sistema',
    grants: () => true,
  },
  {
    name: 'manager',
    description: 'Gerente – acesso à maioria dos módulos',
    grants: (p) => !['users', 'settings'].includes(p.resource) || p.action === 'read',
  },
  {
    name: 'seller',
    description: 'Vendedor – pedidos, produtos e clientes',
    grants: (p) => {
      if (['orders', 'customers'].includes(p.resource))
        return ['create', 'read', 'update'].includes(p.action);
      if (p.resource === 'products') return p.action === 'read';
      if (p.resource === 'reports') return p.action === 'read';
      if (p.resource === 'payment-methods') return p.action === 'read';
      if (p.resource === 'payment-conditions') return p.action === 'read';
      if (p.resource === 'cash-registers') return p.action === 'read-session';
      return false;
    },
  },
  {
    name: 'warehouse',
    description: 'Estoquista – gestão de estoque e produtos',
    grants: (p) => {
      if (p.resource === 'inventory') return true;
      if (p.resource === 'products') return ['read', 'update'].includes(p.action);
      if (p.resource === 'purchases') return p.action === 'read';
      return false;
    },
  },
  {
    name: 'financial',
    description: 'Financeiro – contas a pagar/receber, relatórios',
    grants: (p) => {
      if (p.resource === 'financial') return true;
      if (p.resource === 'reports') return true;
      if (p.resource === 'fiscal') return ['read', 'export'].includes(p.action);
      if (['orders', 'customers', 'purchases'].includes(p.resource))
        return p.action === 'read';
      if (['payment-methods', 'payment-conditions'].includes(p.resource)) return true;
      if (p.resource === 'cash-registers') return true;
      return false;
    },
  },
  {
    name: 'viewer',
    description: 'Visualizador – somente leitura',
    grants: (p) => p.action === 'read' || p.action === 'read-session',
  },
];

/** Roles that always pass a permission check, whatever the stored grants say. */
export const FULL_ACCESS_ROLES = ['owner', 'admin'];

/**
 * Short human label per role, for badges and selects.
 *
 * The settings screen kept its own map — `admin | manager | operator | viewer` —
 * which names a role (`operator`) that does not exist and misses four that do
 * (`owner`, `seller`, `warehouse`, `financial`). A role outside the map rendered
 * its raw slug. Same divergence class as the permission matrix: derive it here.
 */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Vendedor',
  warehouse: 'Estoquista',
  financial: 'Financeiro',
  viewer: 'Visualizador',
};

/** The label of a role, falling back to its own name for a custom role. */
export function getRoleLabel(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName;
}

/** The permissions a role gets, resolved from its `grants` rule. */
export function getRolePermissions(roleName: string): PermissionName[] {
  const role = ROLE_DEFINITIONS.find((r) => r.name === roleName);
  if (!role) return [];
  return PERMISSIONS.filter((name) => role.grants(parsePermission(name)));
}

/**
 * Whether a set of granted permissions satisfies `required`.
 * `owner` and `admin` always pass — the seed grants them everything, and this
 * keeps the UI consistent with the backend if a grant row is ever missing.
 */
export function hasPermission(
  granted: readonly string[],
  required: string,
  roleName?: string | null,
): boolean {
  if (roleName && FULL_ACCESS_ROLES.includes(roleName)) return true;
  return granted.includes(required);
}

import type { OrderStatus } from '@erp/shared-types';

// ─── Order status transitions ──────────────────────────────────────────

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['COMPLETED', 'RETURNED'],
  COMPLETED: [],
  CANCELLED: [],
  RETURNED: [],
};

// ─── Marketplace rate limits ───────────────────────────────────────────

export const MARKETPLACE_RATE_LIMITS = {
  MERCADO_LIVRE: {
    requestsPerMinute: 60,
    requestsPerHour: 3000,
    burstLimit: 10,
  },
  AMAZON: {
    requestsPerMinute: 30,
    requestsPerHour: 1800,
    burstLimit: 5,
  },
  SHOPEE: {
    requestsPerMinute: 40,
    requestsPerHour: 2000,
    burstLimit: 8,
  },
  MAGALU: {
    requestsPerMinute: 30,
    requestsPerHour: 1500,
    burstLimit: 5,
  },
  SHOPIFY: {
    requestsPerMinute: 40,
    requestsPerHour: 2000,
    burstLimit: 8,
  },
  NUVEMSHOP: {
    requestsPerMinute: 30,
    requestsPerHour: 1500,
    burstLimit: 5,
  },
} as const;

// ─── Default permissions ───────────────────────────────────────────────

export const DEFAULT_PERMISSIONS = [
  // Products
  'products:create',
  'products:read',
  'products:update',
  'products:delete',
  // Orders
  'orders:create',
  'orders:read',
  'orders:update',
  'orders:delete',
  'orders:cancel',
  // Customers
  'customers:create',
  'customers:read',
  'customers:update',
  'customers:delete',
  // Inventory
  'inventory:read',
  'inventory:adjust',
  'inventory:transfer',
  // Marketplace
  'marketplace:connect',
  'marketplace:sync',
  'marketplace:configure',
  // Reports
  'reports:sales',
  'reports:inventory',
  'reports:financial',
  // Users & Roles
  'users:create',
  'users:read',
  'users:update',
  'users:delete',
  'roles:create',
  'roles:read',
  'roles:update',
  'roles:delete',
  // Settings
  'settings:read',
  'settings:update',
  // Warehouses
  'warehouses:create',
  'warehouses:read',
  'warehouses:update',
  'warehouses:delete',
] as const;

export type Permission = (typeof DEFAULT_PERMISSIONS)[number];

// ─── System roles ──────────────────────────────────────────────────────

export const SYSTEM_ROLES = {
  admin: {
    name: 'Administrator',
    description: 'Full system access',
    permissions: [...DEFAULT_PERMISSIONS],
  },
  manager: {
    name: 'Manager',
    description: 'Manage operations, no user/role management',
    permissions: DEFAULT_PERMISSIONS.filter(
      (p) => !p.startsWith('users:') && !p.startsWith('roles:') && p !== 'settings:update',
    ),
  },
  operator: {
    name: 'Operator',
    description: 'Day-to-day operations',
    permissions: [
      'products:read',
      'orders:create',
      'orders:read',
      'orders:update',
      'customers:create',
      'customers:read',
      'customers:update',
      'inventory:read',
      'inventory:adjust',
      'reports:sales',
      'reports:inventory',
    ],
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: DEFAULT_PERMISSIONS.filter((p) => p.endsWith(':read')),
  },
} as const;

// ─── Brazilian tax rates ───────────────────────────────────────────────

export const TAX_RATES = {
  ICMS: {
    default: 0.18,
    interstate: {
      south_southeast_to_other: 0.07,
      other_to_south_southeast: 0.12,
      same_region: 0.12,
    },
  },
  IPI: {
    default: 0.05,
  },
  PIS: {
    cumulative: 0.0065,
    nonCumulative: 0.0165,
  },
  COFINS: {
    cumulative: 0.03,
    nonCumulative: 0.076,
  },
  CSLL: {
    default: 0.09,
  },
  IRPJ: {
    default: 0.15,
    surcharge: 0.10,
    surchargeThreshold: 20000,
  },
  SIMPLES_NACIONAL: {
    tier1: { maxRevenue: 180000, rate: 0.06 },
    tier2: { maxRevenue: 360000, rate: 0.112 },
    tier3: { maxRevenue: 720000, rate: 0.135 },
    tier4: { maxRevenue: 1800000, rate: 0.16 },
    tier5: { maxRevenue: 3600000, rate: 0.21 },
    tier6: { maxRevenue: 4800000, rate: 0.33 },
  },
} as const;

// ─── Brazilian states ──────────────────────────────────────────────────

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianState = (typeof BRAZILIAN_STATES)[number];

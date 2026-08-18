import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  getRolePermissions,
  hasPermission,
  parsePermission,
} from '@erp/constants';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PaymentMethodsController } from '../../modules/payment-methods/payment-methods.controller';
import { PaymentConditionsController } from '../../modules/payment-conditions/payment-conditions.controller';
import { CashRegistersController } from '../../modules/cash-registers/cash-registers.controller';

/**
 * The permission matrix is only useful if it matches what the controllers
 * actually demand. Before lote 4 it did not: `@erp/constants` exported an
 * invented list (`roles:create`, `reports:financial`) while the guard read
 * `resource:action` rows written by the seed. A frontend built on the constants
 * list would gate on permissions that can never exist.
 *
 * The first test below closes that hole for good: every string passed to
 * `@RequirePermissions` in the codebase must be a permission the seed creates.
 */

const MODULES_DIR = join(__dirname, '..', '..', 'modules');

async function collectControllerFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry);
      if ((await stat(full)).isDirectory()) return collectControllerFiles(full);
      return full.endsWith('.controller.ts') ? [full] : [];
    }),
  );
  return nested.flat();
}

async function requiredPermissionsInSource(): Promise<
  { file: string; permission: string }[]
> {
  const files = await collectControllerFiles(MODULES_DIR);
  const perFile = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, 'utf8');
      const found: { file: string; permission: string }[] = [];
      for (const match of source.matchAll(/@RequirePermissions\(([^)]*)\)/g)) {
        for (const quoted of match[1].matchAll(/'([^']+)'/g)) {
          found.push({
            file: file.replace(MODULES_DIR, 'modules'),
            permission: quoted[1],
          });
        }
      }
      return found;
    }),
  );
  return perFile.flat();
}

describe('permission matrix', () => {
  it('every permission required by a controller exists in the matrix', async () => {
    const required = await requiredPermissionsInSource();
    expect(required.length).toBeGreaterThan(0);

    const unknown = required.filter(
      (r) => !(PERMISSIONS as readonly string[]).includes(r.permission),
    );

    expect(unknown).toEqual([]);
  });

  it('describes every permission it declares', () => {
    expect(PERMISSION_DEFINITIONS).toHaveLength(PERMISSIONS.length);
    for (const definition of PERMISSION_DEFINITIONS) {
      expect(definition.description.trim()).not.toBe('');
      expect(definition.resource).not.toBe('');
      expect(definition.action).not.toBe('');
    }
  });

  it('splits only on the first colon so hyphenated actions survive', () => {
    expect(parsePermission('cash-registers:read-session')).toEqual({
      resource: 'cash-registers',
      action: 'read-session',
    });
  });

  it('has no duplicate permission names', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });
});

describe('role definitions', () => {
  it('gives owner and admin every permission', () => {
    expect(getRolePermissions('owner')).toHaveLength(PERMISSIONS.length);
    expect(getRolePermissions('admin')).toHaveLength(PERMISSIONS.length);
  });

  it('returns nothing for an unknown role', () => {
    expect(getRolePermissions('nao-existe')).toEqual([]);
  });

  describe('seller (VD-07)', () => {
    const seller = getRolePermissions('seller');

    it.each([
      'orders:create',
      'orders:read',
      'orders:update',
      'customers:create',
      'customers:read',
      'products:read',
      'payment-methods:read',
      'payment-conditions:read',
      'cash-registers:read-session',
    ])('can %s — everything the point of sale needs', (permission) => {
      expect(seller).toContain(permission);
    });

    it.each([
      'financial:read',
      'financial:create',
      'inventory:read',
      'settings:update',
      'users:read',
      'products:delete',
    ])('cannot %s', (permission) => {
      expect(seller).not.toContain(permission);
    });
  });

  it('keeps the financial role able to manage payment methods and cash registers', () => {
    const financial = getRolePermissions('financial');
    expect(financial).toContain('payment-methods:read');
    expect(financial).toContain('payment-conditions:read');
    expect(financial).toContain('cash-registers:read-session');
    expect(financial).toContain('financial:create');
  });

  it('keeps viewer read-only, including the hyphenated read-session', () => {
    const viewer = getRolePermissions('viewer');
    expect(viewer).toContain('financial:read');
    expect(viewer).toContain('cash-registers:read-session');
    expect(viewer.filter((p) => p.endsWith(':create'))).toEqual([]);
    expect(viewer.filter((p) => p.endsWith(':delete'))).toEqual([]);
  });

  it('names every role uniquely', () => {
    const names = ROLE_DEFINITIONS.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('point of sale endpoints (VD-07)', () => {
  // Reads the decorator metadata, not the source text: if someone raises one of
  // these back to `financial:read`, the seller stops being able to sell and this
  // test says so.
  const requiredBy = (handler: unknown): string[] =>
    Reflect.getMetadata(PERMISSIONS_KEY, handler as object) ?? [];

  const seller: string[] = getRolePermissions('seller');

  it.each([
    ['GET /payment-methods', PaymentMethodsController.prototype.findAll],
    ['GET /payment-methods/:id', PaymentMethodsController.prototype.findOne],
    ['GET /payment-conditions', PaymentConditionsController.prototype.findAll],
    ['GET /payment-conditions/:id', PaymentConditionsController.prototype.findOne],
    ['GET /cash-register-sessions', CashRegistersController.prototype.findAllSessions],
    ['GET /cash-registers/:id/session', CashRegistersController.prototype.getCurrentSession],
  ])('%s is reachable by the seller role', (_route, handler) => {
    const required = requiredBy(handler);
    expect(required.length).toBeGreaterThan(0);
    for (const permission of required) {
      expect(seller).toContain(permission);
    }
  });

  it.each([
    ['GET /cash-registers', CashRegistersController.prototype.findAll],
    ['POST /cash-registers/:id/open', CashRegistersController.prototype.openSession],
    ['POST /payment-methods', PaymentMethodsController.prototype.create],
    ['PATCH /payment-conditions/:id', PaymentConditionsController.prototype.update],
  ])('%s stays closed to the seller role', (_route, handler) => {
    const required = requiredBy(handler);
    expect(required.length).toBeGreaterThan(0);
    expect(required.some((permission) => !seller.includes(permission))).toBe(true);
  });
});

describe('hasPermission', () => {
  it('is true when the permission was granted', () => {
    expect(hasPermission(['orders:read'], 'orders:read')).toBe(true);
  });

  it('is false when it was not', () => {
    expect(hasPermission(['orders:read'], 'financial:read')).toBe(false);
  });

  it('lets owner and admin through even with an empty grant list', () => {
    expect(hasPermission([], 'financial:read', 'owner')).toBe(true);
    expect(hasPermission([], 'financial:read', 'admin')).toBe(true);
  });

  it('does not let any other role through on the role name alone', () => {
    expect(hasPermission([], 'financial:read', 'seller')).toBe(false);
    expect(hasPermission([], 'financial:read', null)).toBe(false);
  });
});

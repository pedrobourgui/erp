import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../../database/prisma/prisma.service';
import { createMockPrismaService } from '../../../test/helpers/test.utils';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: ReturnType<typeof createMockPrismaService>;

  /** The request object the guard mutates — inspected by the exposure tests. */
  let request: { user?: Record<string, unknown> };

  function createMockExecutionContext(user?: {
    sub: string;
    tenantId: string;
    roleId?: string | null;
  }): ExecutionContext {
    request = { user };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  /**
   * The guard reads two metadata keys now: the required permissions and the
   * `@ResolvePermissions()` flag. A mock that answers the same value to both
   * would make every test also turn the flag on.
   */
  function setMetadata({
    required,
    resolve,
  }: {
    required?: string[];
    resolve?: boolean;
  }) {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PERMISSIONS_KEY ? required : resolve,
    );
  }

  /** Shapes the `role.findUnique` answer the guard expects. */
  function mockRole(permissions: string[], name = 'manager') {
    prisma.role.findUnique.mockResolvedValue({
      name,
      permissions: permissions.map((p) => {
        const [resource, action] = [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)];
        return { permission: { resource, action } };
      }),
    });
  }

  beforeEach(async () => {
    prisma = createMockPrismaService();
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // canActivate
  // ═══════════════════════════════════════════════════════════════════════════
  describe('canActivate', () => {
    it('should allow access when no permissions are required (no @RequirePermissions decorator)', async () => {
      setMetadata({});
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
    });

    it('should allow access when required permissions is an empty array', async () => {
      setMetadata({ required: [] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
    });

    it('should allow access when user has all required permissions', async () => {
      setMetadata({ required: ['products:create', 'products:read'] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      mockRole(['products:create', 'products:read', 'orders:read']);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should expose the role's permissions on the request so endpoints can narrow their response", async () => {
      setMetadata({ required: ['orders:read'] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      mockRole(['orders:read', 'cash-registers:read-session']);

      await guard.canActivate(context);

      expect(request.user?.permissions).toEqual([
        'orders:read',
        'cash-registers:read-session',
      ]);
    });

    it('should throw ForbiddenException when user lacks required permissions', async () => {
      setMetadata({ required: ['products:delete'] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      mockRole(['products:read']);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Permissão insuficiente para esta ação',
      );
    });

    it('should throw ForbiddenException when user has no roleId (null)', async () => {
      setMetadata({ required: ['products:read'] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Usuário não possui role atribuída',
      );
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user roleId is undefined', async () => {
      setMetadata({ required: ['products:read'] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Usuário não possui role atribuída',
      );
    });

    it('should check ALL required permissions (AND logic)', async () => {
      setMetadata({ required: ['products:create',    'products:delete',    'orders:read',] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      // User has products:create and orders:read but NOT products:delete
      mockRole(['products:create', 'orders:read']);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should query the role by roleId from the JWT user', async () => {
      const roleId = 'role-uuid-specific';
      setMetadata({ required: ['products:read'] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId,
      });

      mockRole(['products:read']);

      await guard.canActivate(context);

      expect(prisma.role.findUnique.mock.calls[0][0].where).toEqual({ id: roleId });
    });
    // ─── @ResolvePermissions (AE-18) ───────────────────────────────────────

    it('should resolve permissions without requiring any when the route asks', async () => {
      // Global search is open to any authenticated user, but the response is
      // narrowed per group. Before the flag, `@CurrentPermissions()` returned
      // `[]` on such a route and the search answered nothing for everyone.
      setMetadata({ resolve: true });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });
      mockRole(['customers:read', 'products:read'], 'seller');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user?.permissions).toEqual(['customers:read', 'products:read']);
      expect(request.user?.roleName).toBe('seller');
    });

    it('should expose the role name so full-access roles can be recognised', async () => {
      setMetadata({ required: ['orders:read'] });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });
      mockRole(['orders:read'], 'owner');

      await guard.canActivate(context);

      expect(request.user?.roleName).toBe('owner');
    });

    it('should let a user with no role through a resolve-only route, with nothing granted', async () => {
      setMetadata({ resolve: true });
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: null,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user?.permissions).toEqual([]);
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
    });
  });
});

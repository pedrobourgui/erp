import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../../database/prisma/prisma.service';
import { createMockPrismaService } from '../../../test/helpers/test.utils';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: ReturnType<typeof createMockPrismaService>;

  function createMockExecutionContext(user?: {
    sub: string;
    tenantId: string;
    roleId?: string | null;
  }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
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
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('should allow access when required permissions is an empty array', async () => {
      reflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('should allow access when user has all required permissions', async () => {
      reflector.getAllAndOverride.mockReturnValue(['products:create', 'products:read']);
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { resource: 'products', action: 'create' } },
        { permission: { resource: 'products', action: 'read' } },
        { permission: { resource: 'orders', action: 'read' } },
      ]);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks required permissions', async () => {
      reflector.getAllAndOverride.mockReturnValue(['products:delete']);
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { resource: 'products', action: 'read' } },
      ]);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Permissão insuficiente para esta ação',
      );
    });

    it('should throw ForbiddenException when user has no roleId (null)', async () => {
      reflector.getAllAndOverride.mockReturnValue(['products:read']);
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: null,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Usuário não possui role atribuída',
      );
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user roleId is undefined', async () => {
      reflector.getAllAndOverride.mockReturnValue(['products:read']);
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
      reflector.getAllAndOverride.mockReturnValue([
        'products:create',
        'products:delete',
        'orders:read',
      ]);
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId: 'role-uuid-001',
      });

      // User has products:create and orders:read but NOT products:delete
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { resource: 'products', action: 'create' } },
        { permission: { resource: 'orders', action: 'read' } },
      ]);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should query rolePermission by roleId from the JWT user', async () => {
      const roleId = 'role-uuid-specific';
      reflector.getAllAndOverride.mockReturnValue(['products:read']);
      const context = createMockExecutionContext({
        sub: 'user-uuid-001',
        tenantId: 'tenant-uuid-001',
        roleId,
      });

      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { resource: 'products', action: 'read' } },
      ]);

      await guard.canActivate(context);

      expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({
        where: { roleId },
        include: { permission: true },
      });
    });
  });
});

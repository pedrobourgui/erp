import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  RESOLVE_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // AE-18: a route may need the caller's permissions to narrow its
    // **response** without requiring any of them to be called. Before this
    // flag, `@CurrentPermissions()` silently returned `[]` on such a route —
    // a trap that reads as "this user has no permissions".
    const shouldResolve = this.reflector.getAllAndOverride<boolean>(
      RESOLVE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isRequired = !!requiredPermissions && requiredPermissions.length > 0;
    if (!isRequired && !shouldResolve) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as {
      sub: string;
      tenantId: string;
      roleId?: string;
    };

    if (!user?.roleId) {
      if (!isRequired) {
        // Nothing to enforce — a user with no role simply searches nothing.
        request.user = { ...user, permissions: [], roleName: null };
        return true;
      }
      throw new ForbiddenException('Usuário não possui role atribuída');
    }

    const role = await this.prisma.role.findUnique({
      where: { id: user.roleId },
      select: {
        name: true,
        permissions: {
          select: { permission: { select: { resource: true, action: true } } },
        },
      },
    });

    const userPermissions = (role?.permissions ?? []).map(
      (rp) => `${rp.permission.resource}:${rp.permission.action}`,
    );

    // Disponibiliza as permissões resolvidas para o handler (@CurrentPermissions).
    // Endpoints compartilhados por papéis diferentes usam isso para estreitar a
    // resposta — o vendedor lê a sessão de caixa aberta, não o histórico inteiro.
    request.user = {
      ...user,
      permissions: userPermissions,
      roleName: role?.name ?? null,
    };

    if (!isRequired) {
      return true;
    }

    // Verificar se tem todas as permissões necessárias
    const hasAllPermissions = requiredPermissions.every((required) =>
      userPermissions.includes(required),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Permissão insuficiente para esta ação');
    }

    return true;
  }
}

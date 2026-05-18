import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
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

    // Se nenhuma permissão é exigida, libera
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as {
      sub: string;
      tenantId: string;
      roleId?: string;
    };

    if (!user?.roleId) {
      throw new ForbiddenException('Usuário não possui role atribuída');
    }

    // Buscar permissões do role do usuário
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: user.roleId },
      include: { permission: true },
    });

    const userPermissions = rolePermissions.map(
      (rp) => `${rp.permission.resource}:${rp.permission.action}`,
    );

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

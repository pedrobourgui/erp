import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extrai o tenantId do request (injetado pelo JwtStrategy).
 * Uso: @CurrentTenant() tenantId: string
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId;
  },
);

/**
 * Extrai o userId do request.
 * Uso: @CurrentUser() userId: string
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.sub;
  },
);

/**
 * Extrai as permissões do papel do usuário, resolvidas pelo `PermissionsGuard`.
 * Só está preenchido em rotas que declaram `@RequirePermissions`.
 * Uso: @CurrentPermissions() permissions: string[]
 */
export const CurrentPermissions = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string[] => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.permissions ?? [];
  },
);

/**
 * Nome do papel do usuário, resolvido pelo `PermissionsGuard`.
 * Só está preenchido em rotas com `@RequirePermissions` ou `@ResolvePermissions`.
 * Uso: @CurrentRole() roleName: string | null
 */
export const CurrentRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.roleName ?? null;
  },
);

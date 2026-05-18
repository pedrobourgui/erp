import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Define as permissões necessárias para acessar um endpoint.
 * Formato: 'recurso:ação' (ex: 'products:create', 'orders:read')
 *
 * Uso: @RequirePermissions('products:create', 'products:update')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

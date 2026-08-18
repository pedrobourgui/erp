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

export const RESOLVE_PERMISSIONS_KEY = 'resolvePermissions';

/**
 * Faz o `PermissionsGuard` resolver as permissões do usuário **sem exigir
 * nenhuma**, para o handler poder estreitar a resposta com `@CurrentPermissions()`.
 *
 * AE-18: a busca global é aberta a qualquer usuário autenticado, mas cada
 * grupo de resultados é filtrado pela permissão de quem busca. Sem este flag o
 * guard retornava cedo e `@CurrentPermissions()` entregava `[]` — o que a
 * rota leria como "este usuário não pode ver nada".
 */
export const ResolvePermissions = () =>
  SetMetadata(RESOLVE_PERMISSIONS_KEY, true);

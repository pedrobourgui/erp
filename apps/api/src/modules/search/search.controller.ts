import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ResolvePermissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentTenant,
  CurrentPermissions,
  CurrentRole,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * AE-18: the topbar "Buscar..." field accepted typing and did nothing.
   *
   * No `@RequirePermissions` on the route on purpose: every authenticated user
   * may search, and the **response** is what gets narrowed — a seller sees
   * customers, products and orders, never a group they cannot open.
   */
  @Get()
  @ResolvePermissions()
  @ApiOperation({ summary: 'Busca global em clientes, produtos e pedidos' })
  async search(
    @CurrentTenant() tenantId: string,
    @CurrentPermissions() permissions: string[],
    @CurrentRole() roleName: string | null,
    @Query() query: SearchQueryDto,
  ) {
    const groups = await this.searchService.search(
      tenantId,
      query.q ?? '',
      permissions,
      roleName,
    );

    return { success: true, data: groups };
  }
}

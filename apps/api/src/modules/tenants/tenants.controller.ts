import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Obter informações do tenant atual' })
  async getCurrent(@CurrentTenant() tenantId: string) {
    const tenant = await this.tenantsService.findById(tenantId);

    return {
      success: true,
      data: tenant,
    };
  }

  @Patch('current')
  @RequirePermissions('settings:update')
  @ApiOperation({ summary: 'Atualizar dados do tenant atual' })
  async updateCurrent(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    const tenant = await this.tenantsService.update(tenantId, dto);

    return {
      success: true,
      data: tenant,
    };
  }
}

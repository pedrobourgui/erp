import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentPermissions,
  CurrentTenant,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Get dashboard summary with KPIs and recent orders' })
  async getDashboard(
    @CurrentTenant() tenantId: string,
    @CurrentPermissions() permissions: string[],
  ) {
    const data = await this.reportsService.getDashboard(tenantId, {
      includeFinancial: permissions.includes('financial:read'),
    });

    return {
      success: true,
      data,
    };
  }
}

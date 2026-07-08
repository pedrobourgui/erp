import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Chart of Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('chart-of-accounts')
export class ChartOfAccountsController {
  constructor(private readonly chartOfAccountsService: ChartOfAccountsService) {}

  @Get()
  @RequirePermissions('financial:read')
  @ApiOperation({ summary: 'List chart of accounts (categorias)' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: AccountType,
  ) {
    return this.chartOfAccountsService.findAll(tenantId, type);
  }
}

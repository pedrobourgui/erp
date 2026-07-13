import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinancialEntriesService } from './financial-entries.service';
import { FinancialSettlementsService } from './financial-settlements.service';
import {
  CreateFinancialEntryDto,
  FinancialEntryQueryDto,
} from './dto/financial-entry.dto';
import { SettleFinancialEntryDto } from './dto/settle-financial-entry.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Financial Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('financial-entries')
export class FinancialEntriesController {
  constructor(
    private readonly financialEntriesService: FinancialEntriesService,
    private readonly financialSettlementsService: FinancialSettlementsService,
  ) {}

  @Get()
  @RequirePermissions('financial:read')
  @ApiOperation({
    summary: 'List financial entries (despesas/receitas) with filters and totals',
  })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: FinancialEntryQueryDto,
  ) {
    return this.financialEntriesService.findAll(tenantId, query);
  }

  @Post()
  @RequirePermissions('financial:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a manual financial entry (despesa/receita)' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateFinancialEntryDto,
  ) {
    const entry = await this.financialEntriesService.create(tenantId, dto);
    return { success: true, data: entry };
  }

  @Post(':id/settle')
  @RequirePermissions('financial:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Settle (baixar) an open título — credits/debits the linked account',
  })
  async settle(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SettleFinancialEntryDto,
  ) {
    const result = await this.financialSettlementsService.settle(tenantId, id, dto);
    return { success: true, data: result };
  }
}

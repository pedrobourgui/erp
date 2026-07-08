import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinancialEntriesService } from './financial-entries.service';
import {
  CreateFinancialEntryDto,
  FinancialEntryQueryDto,
} from './dto/financial-entry.dto';
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
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinancialAccountsService } from './financial-accounts.service';
import {
  CreateFinancialAccountDto,
  UpdateFinancialAccountDto,
  FinancialAccountQueryDto,
} from './dto/financial-account.dto';
import { TransferBetweenAccountsDto } from './dto/transfer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Financial Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('financial-accounts')
export class FinancialAccountsController {
  constructor(
    private readonly financialAccountsService: FinancialAccountsService,
  ) {}

  @Get()
  @RequirePermissions('financial:read')
  @ApiOperation({ summary: 'List financial accounts with filters' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: FinancialAccountQueryDto,
  ) {
    return this.financialAccountsService.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('financial:read')
  @ApiOperation({ summary: 'Get a financial account by ID' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const account = await this.financialAccountsService.findOne(tenantId, id);
    return { success: true, data: account };
  }

  @Post()
  @RequirePermissions('financial:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new financial account' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateFinancialAccountDto,
  ) {
    const account = await this.financialAccountsService.create(tenantId, dto);
    return { success: true, data: account };
  }

  @Post('transfer')
  @RequirePermissions('financial:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transfer funds between two financial accounts' })
  async transfer(
    @CurrentTenant() tenantId: string,
    @Body() dto: TransferBetweenAccountsDto,
  ) {
    const result = await this.financialAccountsService.transfer(tenantId, dto);
    return { success: true, data: result };
  }

  @Patch(':id')
  @RequirePermissions('financial:update')
  @ApiOperation({ summary: 'Update a financial account' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialAccountDto,
  ) {
    const account = await this.financialAccountsService.update(tenantId, id, dto);
    return { success: true, data: account };
  }

  @Delete(':id')
  @RequirePermissions('financial:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Exclui a conta. Com movimento registrado ela é inativada, nunca apagada (FN-16).',
  })
  async remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    const result = await this.financialAccountsService.remove(tenantId, id);
    return { success: true, data: result };
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentConditionsService } from './payment-conditions.service';
import { CreatePaymentConditionDto } from './dto/create-payment-condition.dto';
import { UpdatePaymentConditionDto } from './dto/update-payment-condition.dto';
import { PaymentConditionQueryDto } from './dto/payment-condition-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Payment Conditions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payment-conditions')
export class PaymentConditionsController {
  constructor(
    private readonly paymentConditionsService: PaymentConditionsService,
  ) {}

  @Get()
  @RequirePermissions('payment-conditions:read')
  @ApiOperation({ summary: 'List payment conditions with pagination and filters' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: PaymentConditionQueryDto,
  ) {
    return this.paymentConditionsService.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('payment-conditions:read')
  @ApiOperation({ summary: 'Get a payment condition by ID' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const condition = await this.paymentConditionsService.findOne(tenantId, id);
    return { success: true, data: condition };
  }

  @Post()
  @RequirePermissions('financial:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payment condition' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreatePaymentConditionDto,
  ) {
    const condition = await this.paymentConditionsService.create(tenantId, dto);
    return { success: true, data: condition };
  }

  @Patch(':id')
  @RequirePermissions('financial:update')
  @ApiOperation({ summary: 'Update a payment condition' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentConditionDto,
  ) {
    const condition = await this.paymentConditionsService.update(tenantId, id, dto);
    return { success: true, data: condition };
  }

  @Delete(':id')
  @RequirePermissions('financial:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a payment condition' })
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.paymentConditionsService.remove(tenantId, id);
  }
}

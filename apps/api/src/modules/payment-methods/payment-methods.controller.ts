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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodQueryDto,
} from './dto/payment-method.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@ApiTags('Payment Methods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
  ) {}

  @Get()
  @RequirePermissions('financial:read')
  @ApiOperation({ summary: 'List payment methods with filters' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: PaymentMethodQueryDto,
  ) {
    return this.paymentMethodsService.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('financial:read')
  @ApiOperation({ summary: 'Get a payment method by ID' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const method = await this.paymentMethodsService.findOne(tenantId, id);
    return { success: true, data: method };
  }

  @Post()
  @RequirePermissions('financial:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payment method' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    const method = await this.paymentMethodsService.create(tenantId, dto);
    return { success: true, data: method };
  }

  @Patch(':id')
  @RequirePermissions('financial:update')
  @ApiOperation({ summary: 'Update a payment method' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    const method = await this.paymentMethodsService.update(tenantId, id, dto);
    return { success: true, data: method };
  }
}

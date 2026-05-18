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
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  OrderQueryDto,
} from './dto/order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentTenant,
  CurrentUser,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('orders:read')
  @ApiOperation({ summary: 'List orders with pagination, filters (status, origin, date range, customer)' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('orders:read')
  @ApiOperation({ summary: 'Get order detail with items, customer, and status history' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const order = await this.ordersService.findOne(tenantId, id);
    return { success: true, data: order };
  }

  @Post()
  @RequirePermissions('orders:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    const order = await this.ordersService.create(tenantId, userId, dto);
    return { success: true, data: order };
  }

  @Patch(':id/status')
  @RequirePermissions('orders:update')
  @ApiOperation({ summary: 'Transition order status (with state machine validation)' })
  async updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const order = await this.ordersService.updateStatus(tenantId, id, userId, dto);
    return { success: true, data: order };
  }

  @Patch(':id/cancel')
  @RequirePermissions('orders:update')
  @ApiOperation({ summary: 'Cancel an order with reason' })
  async cancel(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    const order = await this.ordersService.cancel(tenantId, id, userId, dto);
    return { success: true, data: order };
  }

  @Get(':id/timeline')
  @RequirePermissions('orders:read')
  @ApiOperation({ summary: 'Get order status history timeline' })
  async getTimeline(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const timeline = await this.ordersService.getTimeline(tenantId, id);
    return { success: true, data: timeline };
  }
}

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
import { InventoryService } from './inventory.service';
import {
  CreateMovementDto,
  TransferStockDto,
  InventoryQueryDto,
  MovementQueryDto,
  CreateWarehouseDto,
  AlertQueryDto,
} from './dto/inventory.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentTenant,
  CurrentUser,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'List stock by product/warehouse' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: InventoryQueryDto,
  ) {
    return this.inventoryService.findAll(tenantId, query);
  }

  @Post('movement')
  @RequirePermissions('inventory:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register stock movement (entry, exit, transfer, adjustment)' })
  async createMovement(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateMovementDto,
  ) {
    const movement = await this.inventoryService.createMovement(
      tenantId,
      userId,
      dto,
    );
    return { success: true, data: movement };
  }

  @Get('movements')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'List inventory movements with filters' })
  async findMovements(
    @CurrentTenant() tenantId: string,
    @Query() query: MovementQueryDto,
  ) {
    return this.inventoryService.findMovements(tenantId, query);
  }

  @Get('warehouses')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'List warehouses for tenant' })
  async getWarehouses(
    @CurrentTenant() tenantId: string,
    @Query() query: InventoryQueryDto,
  ) {
    return this.inventoryService.getWarehouses(tenantId, query);
  }

  @Post('warehouses')
  @RequirePermissions('inventory:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a warehouse' })
  async createWarehouse(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    const warehouse = await this.inventoryService.createWarehouse(tenantId, dto);
    return { success: true, data: warehouse };
  }

  @Get('alerts')
  @RequirePermissions('inventory:read')
  @ApiOperation({ summary: 'Get low stock alerts' })
  async getLowStockAlerts(
    @CurrentTenant() tenantId: string,
    @Query() query: AlertQueryDto,
  ) {
    return this.inventoryService.getLowStockAlerts(tenantId, query);
  }

  @Post('transfer')
  @RequirePermissions('inventory:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transfer stock between warehouses' })
  async transferStock(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Body() dto: TransferStockDto,
  ) {
    const movement = await this.inventoryService.transferStock(
      tenantId,
      userId,
      dto,
    );
    return { success: true, data: movement };
  }
}

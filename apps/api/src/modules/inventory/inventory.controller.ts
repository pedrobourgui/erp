import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
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
  AdjustStockDto,
  InventoryQueryDto,
  MovementQueryDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  AlertQueryDto,
  UpdateMinStockDto,
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

  @Patch('warehouses/:id')
  @RequirePermissions('inventory:update')
  @ApiOperation({ summary: 'Update a warehouse' })
  async updateWarehouse(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    const warehouse = await this.inventoryService.updateWarehouse(tenantId, id, dto);
    return { success: true, data: warehouse };
  }

  @Delete('warehouses/:id')
  @RequirePermissions('inventory:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove or deactivate a warehouse' })
  async removeWarehouse(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.removeWarehouse(tenantId, id);
  }

  @Patch('items/:id/min-stock')
  @RequirePermissions('inventory:update')
  @ApiOperation({ summary: 'Set minimum-stock threshold for an inventory item' })
  async setMinStock(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMinStockDto,
  ) {
    const item = await this.inventoryService.setMinStock(tenantId, id, dto.minStock);
    return { success: true, data: item };
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

  // AE-25: a transfer moves stock between warehouses and an adjustment
  // rewrites a balance with no document behind it — neither is a plain entry,
  // so both have their own grant instead of riding on `inventory:create`.
  @Post('transfer')
  @RequirePermissions('inventory:transfer')
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

  @Post('adjustment')
  @RequirePermissions('inventory:adjust')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adjust a stock balance to a counted quantity' })
  async adjustStock(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Body() dto: AdjustStockDto,
  ) {
    const movement = await this.inventoryService.adjustStock(
      tenantId,
      userId,
      dto,
    );
    return { success: true, data: movement };
  }
}

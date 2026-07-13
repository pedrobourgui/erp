import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, MovementType, MovementReason } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateMovementDto,
  TransferStockDto,
  InventoryQueryDto,
  MovementQueryDto,
  CreateWarehouseDto,
  AlertQueryDto,
} from './dto/inventory.dto';
import {
  buildPaginatedResponse,
  PaginatedResponse,
} from '../../common/utils/pagination';
import { StockLowEvent } from '../../events/event-types';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * List warehouses for a tenant (paginated).
   */
  async getWarehouses(
    tenantId: string,
    query: InventoryQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { tenantId };

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortOrder: 'desc' });
  }

  /**
   * Create a warehouse for a tenant.
   */
  async createWarehouse(tenantId: string, dto: CreateWarehouseDto) {
    // Auto-generate code from name if not provided
    const code = dto.code || dto.name.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').slice(0, 50);

    // Compose full address from parts if city/state/zipCode provided
    let address = dto.address || '';
    if (dto.city || dto.state || dto.zipCode) {
      const parts = [address, dto.city, dto.state].filter(Boolean);
      address = parts.join(', ');
      if (dto.zipCode) address += ` - CEP: ${dto.zipCode}`;
    }

    const warehouse = await this.prisma.warehouse.create({
      data: {
        tenantId,
        name: dto.name,
        code,
        address: address || null,
        isDefault: dto.isDefault ?? false,
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Warehouse created: ${warehouse.id} (${warehouse.name}) for tenant ${tenantId}`,
    );

    return warehouse;
  }

  /**
   * List inventory items (stock by product/warehouse).
   */
  async findAll(
    tenantId: string,
    query: InventoryQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, productId, warehouseId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryItemWhereInput = { tenantId };
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (search) {
      where.product = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true, status: true } },
          variant: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortOrder: 'desc' });
  }

  /**
   * Register a stock movement (entry, exit, adjustment, return, production).
   */
  async createMovement(
    tenantId: string,
    userId: string,
    dto: CreateMovementDto,
  ) {
    // Validate product exists
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
      select: { id: true, sku: true, name: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const totalCost = dto.unitCost
      ? dto.unitCost * dto.quantity
      : undefined;

    const movement = await this.prisma.$transaction(async (tx) => {
      // Create the movement record
      const created = await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          variantId: dto.variantId,
          type: dto.type as MovementType,
          reason: dto.reason as MovementReason,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          totalCost,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          notes: dto.notes,
          userId,
        },
      });

      // Update inventory based on movement type
      if (dto.type === 'ENTRY' || dto.type === 'RETURN' || dto.type === 'PRODUCTION') {
        if (!dto.toWarehouseId) {
          throw new BadRequestException('toWarehouseId is required for entry/return/production movements');
        }
        await this.upsertInventoryItem(
          tx,
          tenantId,
          dto.productId,
          dto.variantId ?? null,
          dto.toWarehouseId,
          dto.quantity,
        );
      } else if (dto.type === 'EXIT') {
        if (!dto.fromWarehouseId) {
          throw new BadRequestException('fromWarehouseId is required for exit movements');
        }
        await this.upsertInventoryItem(
          tx,
          tenantId,
          dto.productId,
          dto.variantId ?? null,
          dto.fromWarehouseId,
          -dto.quantity,
        );
      } else if (dto.type === 'ADJUSTMENT') {
        // Adjustment can be positive or negative; use toWarehouseId or fromWarehouseId
        const warehouseId = dto.toWarehouseId || dto.fromWarehouseId;
        if (!warehouseId) {
          throw new BadRequestException('A warehouse ID is required for adjustments');
        }
        // For adjustments, positive quantity = add, we decide based on which warehouse is given
        const delta = dto.toWarehouseId ? dto.quantity : -dto.quantity;
        await this.upsertInventoryItem(
          tx,
          tenantId,
          dto.productId,
          dto.variantId ?? null,
          warehouseId,
          delta,
        );
      }
      // TRANSFER is handled via transferStock method

      this.logger.log(
        `Inventory movement: ${dto.type} ${dto.quantity}x ${product.sku} (tenant: ${tenantId})`,
      );

      return created;
    });

    // Check low stock alerts after movement completes
    const affectedWarehouseId = dto.toWarehouseId || dto.fromWarehouseId;
    if (affectedWarehouseId) {
      await this.checkAndUpdateAlerts(
        tenantId,
        dto.productId,
        dto.variantId ?? null,
        affectedWarehouseId,
      );
    }

    return movement;
  }

  /**
   * List inventory movements with filters.
   */
  async findMovements(
    tenantId: string,
    query: MovementQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, productId, warehouseId, type, dateFrom, dateTo, reason, sortBy, sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = { tenantId };
    if (productId) where.productId = productId;
    if (type) where.type = type as any;
    if (reason) where.reason = reason as any;
    if (warehouseId) {
      where.OR = [
        { fromWarehouseId: warehouseId },
        { toWarehouseId: warehouseId },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as any).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as any).lte = new Date(dateTo);
    }

    const orderBy = sortBy
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, name: true } },
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return buildPaginatedResponse(
      data.map((row) => this.toMovementDto(row)),
      total,
      { page, limit, sortOrder: 'desc' },
    );
  }

  /**
   * Flatten a movement for the list: the table shows one product, one user and
   * one warehouse per row, while the model keeps an origin and a destination.
   */
  private toMovementDto(row: MovementRow) {
    // ENTRY lands in the destination; EXIT leaves the origin. A transfer has
    // both — the destination is the one that matters to the reader.
    const warehouse = row.toWarehouse ?? row.fromWarehouse;

    return {
      id: row.id,
      productId: row.productId,
      productName: row.product?.name ?? null,
      productSku: row.product?.sku ?? null,
      variantId: row.variantId,
      warehouseId: warehouse?.id ?? null,
      warehouseName: warehouse?.name ?? null,
      fromWarehouseId: row.fromWarehouseId ?? null,
      toWarehouseId: row.toWarehouseId ?? null,
      type: row.type,
      reason: row.reason,
      quantity: row.quantity,
      unitCost: row.unitCost != null ? Number(row.unitCost) : null,
      userId: row.userId,
      // Sales and shipments move stock with no user behind them
      userName: row.user?.name ?? 'Sistema',
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }

  /**
   * Get low stock alerts with pagination and status filter.
   */
  async getLowStockAlerts(
    tenantId: string,
    query: AlertQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockAlertWhereInput = { tenantId };
    if (status === 'ACTIVE') {
      where.isResolved = false;
    } else if (status === 'RESOLVED') {
      where.isResolved = true;
    }

    const [data, total] = await Promise.all([
      this.prisma.stockAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stockAlert.count({ where }),
    ]);

    return buildPaginatedResponse(
      data.map((row) => this.toAlertDto(row)),
      total,
      { page, limit, sortOrder: 'desc' },
    );
  }

  /**
   * Flatten a stock alert for the list. The model stores ids and `currentQty`;
   * the table reads names and `currentStock`, and derives its badge from
   * `status` — which is `isResolved` spelled out.
   */
  private toAlertDto(row: AlertRow) {
    return {
      id: row.id,
      productId: row.productId,
      productName: row.product?.name ?? null,
      productSku: row.product?.sku ?? null,
      variantId: row.variantId,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse?.name ?? null,
      currentStock: row.currentQty,
      minStock: row.minStock,
      isResolved: row.isResolved,
      status: row.isResolved ? ('RESOLVED' as const) : ('ACTIVE' as const),
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    };
  }

  /**
   * Set the minimum-stock threshold for an inventory item and re-evaluate alerts.
   */
  async setMinStock(tenantId: string, itemId: string, minStock: number) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, tenantId },
    });

    if (!item) {
      throw new NotFoundException(
        `Inventory item with id ${itemId} not found for tenant ${tenantId}`,
      );
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: { minStock },
    });

    // Setting/raising the minimum may immediately put the item below threshold
    await this.checkAndUpdateAlerts(
      tenantId,
      item.productId,
      item.variantId ?? null,
      item.warehouseId,
    );

    return updated;
  }

  /**
   * Transfer stock between warehouses.
   */
  async transferStock(tenantId: string, userId: string, dto: TransferStockDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    // Validate product
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
      select: { id: true, sku: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validate source warehouse has enough stock
    const sourceItem = await this.prisma.inventoryItem.findFirst({
      where: {
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        warehouseId: dto.fromWarehouseId,
        tenantId,
      },
    });

    if (!sourceItem || sourceItem.available < dto.quantity) {
      const available = sourceItem?.available ?? 0;
      throw new BadRequestException(
        `Insufficient stock in source warehouse. Available: ${available}, Requested: ${dto.quantity}`,
      );
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      // Decrease source
      await this.upsertInventoryItem(
        tx,
        tenantId,
        dto.productId,
        dto.variantId ?? null,
        dto.fromWarehouseId,
        -dto.quantity,
      );

      // Increase destination
      await this.upsertInventoryItem(
        tx,
        tenantId,
        dto.productId,
        dto.variantId ?? null,
        dto.toWarehouseId,
        dto.quantity,
      );

      // Create movement record
      const created = await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          variantId: dto.variantId,
          type: 'TRANSFER',
          reason: 'TRANSFER',
          quantity: dto.quantity,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          notes: dto.notes,
          userId,
        },
      });

      this.logger.log(
        `Stock transfer: ${dto.quantity}x ${product.sku} from ${dto.fromWarehouseId} to ${dto.toWarehouseId}`,
      );

      return created;
    });

    // Check low stock alerts for both warehouses
    await this.checkAndUpdateAlerts(tenantId, dto.productId, dto.variantId ?? null, dto.fromWarehouseId);
    await this.checkAndUpdateAlerts(tenantId, dto.productId, dto.variantId ?? null, dto.toWarehouseId);

    return movement;
  }

  /**
   * Reserve stock for an order (called from event handler).
   */
  async reserveStock(
    tenantId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    // Find default or first available warehouse with stock
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        productId,
        variantId: variantId ?? null,
        available: { gte: quantity },
      },
      include: { warehouse: true },
      orderBy: { warehouse: { isDefault: 'desc' } },
    });

    if (!inventoryItem) {
      this.logger.warn(
        `Cannot reserve ${quantity} units of product ${productId}: insufficient stock`,
      );
      return; // Gracefully skip if no stock (order was already created)
    }

    await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        reserved: { increment: quantity },
        available: { decrement: quantity },
      },
    });

    // Check if low stock alert needed
    const updated = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItem.id },
    });
    if (updated && updated.minStock > 0 && updated.available <= updated.minStock) {
      await this.createStockAlert(tenantId, productId, variantId, inventoryItem.warehouseId, updated.available, updated.minStock);
    }

    this.logger.log(`Reserved ${quantity} units of product ${productId}`);
  }

  /**
   * Release reserved stock (called from event handler on cancellation).
   */
  async releaseStock(
    tenantId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        productId,
        variantId: variantId ?? null,
        reserved: { gte: quantity },
      },
      orderBy: { warehouse: { isDefault: 'desc' } },
    });

    if (!inventoryItem) {
      this.logger.warn(
        `Cannot release ${quantity} units of product ${productId}: no matching reservation`,
      );
      return;
    }

    await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        reserved: { decrement: quantity },
        available: { increment: quantity },
      },
    });

    // Check if stock normalized and resolve alert
    const updated = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItem.id },
    });
    if (updated && updated.minStock > 0 && updated.available > updated.minStock) {
      await this.resolveStockAlert(tenantId, productId, variantId, inventoryItem.warehouseId);
    }

    this.logger.log(`Released ${quantity} reserved units of product ${productId}`);
  }

  /**
   * Deduct stock directly for counter sales (EXIT movement, no reservation).
   */
  async deductStockForSale(
    tenantId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        productId,
        variantId: variantId ?? null,
        available: { gte: quantity },
      },
      include: { warehouse: true },
      orderBy: { warehouse: { isDefault: 'desc' } },
    });

    if (!inventoryItem) {
      this.logger.warn(
        `Cannot deduct ${quantity} units of product ${productId}: insufficient stock for counter sale`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Deduct from inventory (quantity and available both decrease)
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          quantity: { decrement: quantity },
          available: { decrement: quantity },
        },
      });

      // Create EXIT movement for audit trail
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId,
          variantId,
          type: 'EXIT',
          reason: 'SALE',
          quantity,
          fromWarehouseId: inventoryItem.warehouseId,
          referenceType: 'ORDER',
          referenceId: orderId,
          notes: 'Venda no balcão - saída direta',
          userId: null,
        },
      });
    });

    // Raise/resolve low- and out-of-stock alerts after the sale
    await this.checkAndUpdateAlerts(tenantId, productId, variantId, inventoryItem.warehouseId);

    this.logger.log(`Deducted ${quantity} units of product ${productId} for counter sale (order ${orderId})`);
  }

  /**
   * Convert a reservation into an actual stock-out when a regular order ships.
   * Units were held in `reserved` on confirmation; now `reserved` and `quantity`
   * both decrease and an EXIT/SALE movement is recorded. `available` is left
   * untouched because it was already decremented at reservation time.
   * (Counter sales use deductStockForSale, which never reserves.)
   */
  async fulfillReservedStock(
    tenantId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        productId,
        variantId: variantId ?? null,
        reserved: { gte: quantity },
      },
      include: { warehouse: true },
      orderBy: { warehouse: { isDefault: 'desc' } },
    });

    if (!inventoryItem) {
      this.logger.warn(
        `Cannot fulfill ${quantity} units of product ${productId}: no matching reservation`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Reservation becomes a real stock-out: reserved and quantity both drop
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          reserved: { decrement: quantity },
          quantity: { decrement: quantity },
        },
      });

      // Create EXIT movement for audit trail
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId,
          variantId,
          type: 'EXIT',
          reason: 'SALE',
          quantity,
          fromWarehouseId: inventoryItem.warehouseId,
          referenceType: 'ORDER',
          referenceId: orderId,
          notes: 'Baixa de estoque - expedição do pedido',
          userId: null,
        },
      });
    });

    // Raise/resolve low- and out-of-stock alerts after the shipment
    await this.checkAndUpdateAlerts(tenantId, productId, variantId, inventoryItem.warehouseId);

    this.logger.log(`Fulfilled ${quantity} reserved units of product ${productId} for order ${orderId}`);
  }

  /**
   * Check low stock levels and emit events.
   */
  async checkLowStock(tenantId: string): Promise<void> {
    const lowStockItems = await this.prisma.$queryRaw<any[]>`
      SELECT
        ii."productId",
        ii."variantId",
        ii."warehouseId",
        ii.available,
        ii."minStock"
      FROM inventory_items ii
      WHERE ii."tenantId" = ${tenantId}
        AND ii."minStock" > 0
        AND ii.available <= ii."minStock"
    `;

    for (const item of lowStockItems) {
      await this.createStockAlert(
        tenantId,
        item.productId,
        item.variantId,
        item.warehouseId,
        item.available,
        item.minStock,
      );
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  /**
   * Upsert inventory item: create if not exists, update quantity if exists.
   */
  private async upsertInventoryItem(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    variantId: string | null,
    warehouseId: string,
    delta: number,
  ): Promise<void> {
    const existing = await tx.inventoryItem.findFirst({
      where: {
        productId,
        variantId: variantId ?? null,
        warehouseId,
      },
    });

    if (existing) {
      const newQuantity = existing.quantity + delta;
      if (newQuantity < 0) {
        throw new BadRequestException(
          `Insufficient stock. Current: ${existing.quantity}, Change: ${delta}`,
        );
      }
      const newAvailable = existing.available + delta;

      await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          quantity: Math.max(newQuantity, 0),
          available: Math.max(newAvailable, 0),
        },
      });
    } else {
      if (delta < 0) {
        throw new BadRequestException('Cannot create inventory item with negative quantity');
      }

      // The item is created lazily on the first movement, so it inherits the
      // product's default minimum (SCRUM-37). An item that later gets its own
      // minimum keeps it — this only seeds the initial value.
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { defaultMinStock: true },
      });

      await tx.inventoryItem.create({
        data: {
          tenantId,
          productId,
          variantId,
          warehouseId,
          quantity: delta,
          available: delta,
          reserved: 0,
          minStock: product?.defaultMinStock ?? 0,
        },
      });
    }
  }

  /**
   * Resolve a stock alert when stock normalizes above minStock.
   */
  private async resolveStockAlert(
    tenantId: string,
    productId: string,
    variantId: string | null,
    warehouseId: string,
  ): Promise<void> {
    const updated = await this.prisma.stockAlert.updateMany({
      where: {
        tenantId,
        productId,
        variantId: variantId ?? undefined,
        warehouseId,
        isResolved: false,
      },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    if (updated.count > 0) {
      this.logger.log(
        `Resolved ${updated.count} stock alert(s) for product ${productId} in warehouse ${warehouseId}`,
      );
    }
  }

  /**
   * Check and update stock alerts after any movement.
   */
  private async checkAndUpdateAlerts(
    tenantId: string,
    productId: string,
    variantId: string | null,
    warehouseId: string,
  ): Promise<void> {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        productId,
        variantId: variantId ?? null,
        warehouseId,
      },
    });

    if (!item) return;

    // Alert on zero stock (out-of-stock) even when no minStock is configured,
    // and on low stock when the item drops to/below its configured minimum.
    const needsAlert =
      item.available <= 0 || (item.minStock > 0 && item.available <= item.minStock);

    if (needsAlert) {
      await this.createStockAlert(
        tenantId,
        productId,
        variantId,
        warehouseId,
        item.available,
        item.minStock,
      );
    } else {
      await this.resolveStockAlert(tenantId, productId, variantId, warehouseId);
    }
  }

  /**
   * Create a stock alert record and emit event.
   */
  private async createStockAlert(
    tenantId: string,
    productId: string,
    variantId: string | null,
    warehouseId: string,
    currentQty: number,
    minStock: number,
  ): Promise<void> {
    // Check if there's already an unresolved alert for this combination
    const existingAlert = await this.prisma.stockAlert.findFirst({
      where: {
        tenantId,
        productId,
        variantId: variantId ?? undefined,
        warehouseId,
        isResolved: false,
      },
    });

    if (existingAlert) return; // Already has an active alert

    await this.prisma.stockAlert.create({
      data: {
        tenantId,
        productId,
        variantId,
        warehouseId,
        currentQty,
        minStock,
      },
    });

    this.eventEmitter.emit(
      'stock.low',
      new StockLowEvent(tenantId, productId, variantId, warehouseId, currentQty, minStock),
    );
  }
}

// ─── Row shapes returned by the queries above (relations included) ──────────

interface NamedRef {
  id: string;
  name: string;
  code?: string;
}

interface MovementRow {
  id: string;
  productId: string;
  variantId: string | null;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  unitCost: Prisma.Decimal | null;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  notes: string | null;
  userId: string | null;
  createdAt: Date;
  product: { id: string; name: string; sku: string } | null;
  user: { id: string; name: string } | null;
  fromWarehouse: NamedRef | null;
  toWarehouse: NamedRef | null;
}

interface AlertRow {
  id: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  currentQty: number;
  minStock: number;
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
  product: { id: string; name: string; sku: string } | null;
  warehouse: NamedRef | null;
}

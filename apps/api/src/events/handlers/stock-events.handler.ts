import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StockLowEvent, EVENT_NAMES } from '../event-types';

@Injectable()
export class StockEventsHandler {
  private readonly logger = new Logger(StockEventsHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * StockLow: create notification and log alert.
   */
  @OnEvent(EVENT_NAMES.STOCK_LOW, { async: true })
  async handleStockLow(event: StockLowEvent): Promise<void> {
    this.logger.warn(
      `Low stock alert: product ${event.productId} in warehouse ${event.warehouseId} ` +
        `(current: ${event.currentQty}, min: ${event.minStock})`,
    );

    try {
      // Fetch product details for the notification message
      const product = await this.prisma.product.findUnique({
        where: { id: event.productId },
        select: { name: true, sku: true },
      });

      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: event.warehouseId },
        select: { name: true, code: true },
      });

      const productLabel = product
        ? `${product.name} (${product.sku})`
        : event.productId;
      const warehouseLabel = warehouse
        ? `${warehouse.name} (${warehouse.code})`
        : event.warehouseId;

      // Find tenant admin/warehouse users to notify
      const usersToNotify = await this.prisma.user.findMany({
        where: {
          tenantId: event.tenantId,
          status: 'ACTIVE',
          role: {
            name: { in: ['owner', 'admin', 'manager', 'warehouse'] },
          },
        },
        select: { id: true },
        take: 10,
      });

      // Create notifications for relevant users
      if (usersToNotify.length > 0) {
        await this.prisma.notification.createMany({
          data: usersToNotify.map((user: { id: string }) => ({
            tenantId: event.tenantId,
            userId: user.id,
            type: 'IN_APP' as const,
            priority: 'HIGH' as const,
            title: 'Low stock alert',
            message:
              `Product ${productLabel} has low stock in ${warehouseLabel}. ` +
              `Current: ${event.currentQty}, Minimum: ${event.minStock}.`,
            data: {
              entity: 'inventory',
              productId: event.productId,
              variantId: event.variantId,
              warehouseId: event.warehouseId,
              currentQty: event.currentQty,
              minStock: event.minStock,
            },
          })),
        });
      }

      // Log in audit trail
      await this.prisma.auditLog.create({
        data: {
          tenantId: event.tenantId,
          entity: 'inventory_item',
          entityId: event.productId,
          action: 'UPDATE',
          newData: {
            type: 'LOW_STOCK_ALERT',
            productId: event.productId,
            variantId: event.variantId,
            warehouseId: event.warehouseId,
            currentQty: event.currentQty,
            minStock: event.minStock,
          },
        },
      });

      this.logger.log(
        `Low stock notifications sent for ${productLabel} (${usersToNotify.length} users notified)`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to handle stock.low event: ${error.message}`,
        error.stack,
      );
    }
  }
}

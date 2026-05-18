import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma/prisma.service';
import { InventoryService } from '../../modules/inventory/inventory.service';
import {
  OrderCreatedEvent,
  OrderConfirmedEvent,
  OrderCancelledEvent,
  OrderCounterSaleEvent,
  EVENT_NAMES,
} from '../event-types';

@Injectable()
export class OrderEventsHandler {
  private readonly logger = new Logger(OrderEventsHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * OrderCreated: create notification (stock is reserved on confirmation, not creation).
   */
  @OnEvent(EVENT_NAMES.ORDER_CREATED, { async: true })
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(`Handling order.created for order ${event.orderId}`);

    try {
      // Create in-app notification
      await this.createNotification(
        event.tenantId,
        event.userId,
        'New order created',
        `Order ${event.orderId} has been created with ${event.items.length} item(s).`,
        'order',
        event.orderId,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to handle order.created for ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * OrderConfirmed: reserve stock for each item, then create accounts receivable entry.
   */
  @OnEvent(EVENT_NAMES.ORDER_CONFIRMED, { async: true })
  async handleOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    this.logger.log(`Handling order.confirmed for order ${event.orderId}`);

    try {
      // Reserve stock for each item (moved here from order.created to avoid double-reservation)
      for (const item of event.items) {
        await this.inventoryService.reserveStock(
          event.tenantId,
          item.productId,
          item.variantId ?? null,
          item.quantity,
        );
      }

      // Get order with payments for receivable creation
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          tenantId: true,
          customerId: true,
          totalAmount: true,
          orderNumber: true,
        },
      });

      if (!order) {
        this.logger.warn(`Order ${event.orderId} not found for receivable creation`);
        return;
      }

      // Generate receivables per installment from OrderPayments
      await this.generateReceivablesForOrder(order.id, event.tenantId, order.customerId, order.orderNumber, false);

      // Create notification
      await this.createNotification(
        event.tenantId,
        event.userId,
        'Order confirmed',
        `Order ${order.orderNumber} has been confirmed.`,
        'order',
        event.orderId,
      );

      this.logger.log(`Stock reserved and receivables created for order ${order.orderNumber}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to handle order.confirmed for ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * OrderCancelled: release reserved stock (only if was confirmed+), cancel receivables.
   */
  @OnEvent(EVENT_NAMES.ORDER_CANCELLED, { async: true })
  async handleOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    this.logger.log(`Handling order.cancelled for order ${event.orderId}`);

    try {
      // Only release stock if the order had been confirmed (stock is reserved on confirmation)
      if (event.previousStatus && event.previousStatus !== 'DRAFT' && event.previousStatus !== 'PENDING') {
        for (const item of event.items) {
          await this.inventoryService.releaseStock(
            event.tenantId,
            item.productId,
            item.variantId ?? null,
            item.quantity,
          );
        }
      }

      // Cancel any existing receivables for this order
      await this.prisma.accountsReceivable.updateMany({
        where: {
          orderId: event.orderId,
          tenantId: event.tenantId,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        data: { status: 'CANCELLED' },
      });

      // Create notification
      await this.createNotification(
        event.tenantId,
        event.userId,
        'Order cancelled',
        `Order ${event.orderId} has been cancelled. Reason: ${event.reason}. Stock has been released.`,
        'order',
        event.orderId,
      );

      this.logger.log(`Stock released and receivables cancelled for order ${event.orderId}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to handle order.cancelled for ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * OrderCounterSale: deduct stock directly (EXIT) and create receivable for counter sales.
   */
  @OnEvent(EVENT_NAMES.ORDER_COUNTER_SALE, { async: true })
  async handleOrderCounterSale(event: OrderCounterSaleEvent): Promise<void> {
    this.logger.log(`Handling order.counter_sale for order ${event.orderId}`);

    try {
      // Deduct stock directly for each item (EXIT, not reserve)
      for (const item of event.items) {
        await this.inventoryService.deductStockForSale(
          event.tenantId,
          item.productId,
          item.variantId ?? null,
          item.quantity,
          event.orderId,
        );
      }

      // Get order details
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          tenantId: true,
          customerId: true,
          totalAmount: true,
          orderNumber: true,
        },
      });

      if (!order) {
        this.logger.warn(`Order ${event.orderId} not found for counter sale processing`);
        return;
      }

      // Generate receivables per installment (counter sales mark cash/PIX/debit as PAID immediately)
      await this.generateReceivablesForOrder(order.id, event.tenantId, order.customerId, order.orderNumber, true);

      // Create notification
      await this.createNotification(
        event.tenantId,
        event.userId,
        'Venda no balcão realizada',
        `Venda ${order.orderNumber} finalizada. Valor: ${order.totalAmount}.`,
        'order',
        event.orderId,
      );

      this.logger.log(`Counter sale completed: stock deducted and receivables created for order ${order.orderNumber}`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to handle order.counter_sale for ${event.orderId}: ${error.message}`,
        error.stack,
      );
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  /**
   * Generate AccountsReceivable records per installment from OrderPayments.
   * For counter sales, immediate payment types (CASH, PIX, DEBIT_CARD) are marked PAID.
   */
  private async generateReceivablesForOrder(
    orderId: string,
    tenantId: string,
    customerId: string | null,
    orderNumber: string,
    isCounterSale: boolean,
  ): Promise<void> {
    const IMMEDIATE_TYPES = ['CASH', 'PIX', 'DEBIT_CARD'];

    const orderPayments = await this.prisma.orderPayment.findMany({
      where: { orderId, tenantId },
      include: {
        paymentMethod: { select: { id: true, name: true, type: true } },
        paymentCondition: { select: { id: true, daysBetweenInstallments: true, entryPercentage: true, type: true } },
      },
    });

    if (orderPayments.length === 0) {
      // No payments recorded — create a single generic receivable (backwards compat)
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { totalAmount: true },
      });
      if (order) {
        await this.prisma.accountsReceivable.create({
          data: {
            tenantId,
            orderId,
            customerId,
            description: `${isCounterSale ? 'Venda balcão' : 'Pedido'} ${orderNumber}`,
            amount: order.totalAmount,
            status: isCounterSale ? 'PAID' : 'PENDING',
            dueDate: isCounterSale ? new Date() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            paidAt: isCounterSale ? new Date() : null,
          },
        });
      }
      return;
    }

    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (const op of orderPayments) {
      const methodType = op.paymentMethod.type;
      const methodName = op.paymentMethod.name;
      const isImmediate = IMMEDIATE_TYPES.includes(methodType);
      const totalInstallments = op.installments;
      const daysBetween = op.paymentCondition?.daysBetweenInstallments ?? 30;
      const entryPct = op.paymentCondition?.entryPercentage ? Number(op.paymentCondition.entryPercentage) : 0;
      const conditionType = op.paymentCondition?.type;

      const amount = Number(op.amount);

      if (totalInstallments <= 1 || conditionType === 'CASH') {
        // Single payment
        const isPaid = isCounterSale && isImmediate;
        await this.prisma.accountsReceivable.create({
          data: {
            tenantId,
            orderId,
            customerId,
            orderPaymentId: op.id,
            paymentMethodId: op.paymentMethodId,
            description: `${orderNumber} - ${methodName}`,
            installment: 1,
            totalInstallments: 1,
            amount,
            status: isPaid ? 'PAID' : 'PENDING',
            dueDate: isImmediate ? now : new Date(now.getTime() + daysBetween * DAY_MS),
            paidAt: isPaid ? now : null,
            paidAmount: isPaid ? amount : 0,
          },
        });
      } else if (conditionType === 'ENTRY_PLUS_INSTALLMENT' && entryPct > 0) {
        // Entry + installments
        const entryAmount = Math.round((amount * entryPct) / 100 * 100) / 100;
        const remaining = amount - entryAmount;
        const perInstallment = Math.round((remaining / totalInstallments) * 100) / 100;
        const isPaidEntry = isCounterSale && isImmediate;

        // Entry receivable
        await this.prisma.accountsReceivable.create({
          data: {
            tenantId,
            orderId,
            customerId,
            orderPaymentId: op.id,
            paymentMethodId: op.paymentMethodId,
            description: `${orderNumber} - ${methodName} (Entrada)`,
            installment: 0,
            totalInstallments: totalInstallments + 1,
            amount: entryAmount,
            status: isPaidEntry ? 'PAID' : 'PENDING',
            dueDate: now,
            paidAt: isPaidEntry ? now : null,
            paidAmount: isPaidEntry ? entryAmount : 0,
          },
        });

        // Installments
        for (let i = 1; i <= totalInstallments; i++) {
          const installmentAmount = i === totalInstallments
            ? remaining - perInstallment * (totalInstallments - 1)
            : perInstallment;

          await this.prisma.accountsReceivable.create({
            data: {
              tenantId,
              orderId,
              customerId,
              orderPaymentId: op.id,
              paymentMethodId: op.paymentMethodId,
              description: `${orderNumber} - ${methodName} (${i}/${totalInstallments})`,
              installment: i,
              totalInstallments: totalInstallments + 1,
              amount: installmentAmount,
              status: 'PENDING',
              dueDate: new Date(now.getTime() + i * daysBetween * DAY_MS),
            },
          });
        }
      } else {
        // Pure installments
        const perInstallment = Math.round((amount / totalInstallments) * 100) / 100;

        for (let i = 1; i <= totalInstallments; i++) {
          const installmentAmount = i === totalInstallments
            ? amount - perInstallment * (totalInstallments - 1)
            : perInstallment;

          await this.prisma.accountsReceivable.create({
            data: {
              tenantId,
              orderId,
              customerId,
              orderPaymentId: op.id,
              paymentMethodId: op.paymentMethodId,
              description: `${orderNumber} - ${methodName} (${i}/${totalInstallments})`,
              installment: i,
              totalInstallments,
              amount: installmentAmount,
              status: 'PENDING',
              dueDate: new Date(now.getTime() + i * daysBetween * DAY_MS),
            },
          });
        }
      }
    }
  }

  private async createNotification(
    tenantId: string,
    userId: string,
    title: string,
    message: string,
    entity: string,
    entityId: string,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          tenantId,
          userId,
          type: 'IN_APP',
          priority: 'MEDIUM',
          title,
          message,
          data: { entity, entityId },
        },
      });
    } catch (err) {
      // Non-critical; log and continue
      const error = err as Error;
      this.logger.warn(`Failed to create notification: ${error.message}`);
    }
  }
}

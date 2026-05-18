import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  OrderQueryDto,
} from './dto/order.dto';
import {
  PaginatedResponse,
  buildPaginatedResponse,
  buildPrismaOrderBy,
} from '../../common/utils/pagination';
import {
  OrderCreatedEvent,
  OrderConfirmedEvent,
  OrderShippedEvent,
  OrderDeliveredEvent,
  OrderCancelledEvent,
  OrderCounterSaleEvent,
} from '../../events/event-types';

/**
 * Allowed status transitions for the order state machine.
 */
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED', 'RETURNED'],
  COMPLETED: [],
  CANCELLED: [],
  RETURNED: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * List orders with pagination and filters.
   */
  async findAll(
    tenantId: string,
    query: OrderQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy,
      sortOrder = 'desc',
      status,
      origin,
      customerId,
      dateFrom,
      dateTo,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (status) where.status = status as any;
    if (origin) where.origin = origin as any;
    if (customerId) where.customerId = customerId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as any).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as any).lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildPrismaOrderBy(sortBy, sortOrder),
        include: {
          customer: { select: { id: true, name: true, email: true } },
          seller: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortBy, sortOrder });
  }

  /**
   * Get order detail with items, customer, and status history.
   */
  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        seller: { select: { id: true, name: true, email: true } },
        salesChannel: { select: { id: true, name: true, type: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: {
          include: {
            paymentMethod: { select: { id: true, name: true, type: true } },
            paymentCondition: { select: { id: true, name: true, code: true } },
            financialAccount: { select: { id: true, name: true } },
          },
        },
        receivables: {
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            description: true,
            installment: true,
            totalInstallments: true,
            amount: true,
            paidAmount: true,
            status: true,
            dueDate: true,
            paidAt: true,
            paymentMethod: { select: { name: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Create a new order: validate items, calculate totals, reserve stock.
   */
  async create(tenantId: string, userId: string, dto: CreateOrderDto) {
    // Validate all products exist and belong to tenant
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, deletedAt: null },
      select: { id: true, sku: true, name: true, salePrice: true },
    });

    if (products.length !== new Set(productIds).size) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = productIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Products not found: ${missing.join(', ')}`);
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Generate sequential order number
    const orderNumber = await this.generateOrderNumber(tenantId);

    // Calculate item totals
    const itemsData = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const discount = item.discount ?? 0;
      const totalPrice = item.quantity * item.unitPrice - discount;

      return {
        productId: item.productId,
        variantId: item.variantId,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount,
        totalPrice: Math.max(totalPrice, 0),
      };
    });

    const subtotal = itemsData.reduce((sum, i) => sum + i.totalPrice, 0);
    const orderDiscount = dto.discount ?? 0;
    const shippingCost = dto.shippingCost ?? 0;
    const totalAmount = subtotal - orderDiscount + shippingCost;

    const isCounterSale = dto.origin === 'BALCAO';

    // Counter sales require a customer
    if (isCounterSale && !dto.customerId) {
      throw new BadRequestException('Cliente é obrigatório para vendas no balcão');
    }

    // For counter sales, validate stock upfront (sale is immediate)
    if (isCounterSale) {
      await this.validateStockForConfirmation(tenantId, itemsData);
    }

    // Validate payments if provided
    const finalTotal = Math.max(totalAmount, 0);
    const payments = dto.payments ?? [];

    if (payments.length > 0) {
      const paymentSum = payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(paymentSum - finalTotal) > 0.01) {
        throw new BadRequestException(
          `Soma dos pagamentos (${paymentSum.toFixed(2)}) difere do total do pedido (${finalTotal.toFixed(2)})`,
        );
      }

      // Validate payment methods exist and belong to tenant
      const methodIds = payments.map((p) => p.paymentMethodId);
      const methods = await this.prisma.paymentMethod.findMany({
        where: { id: { in: methodIds }, tenantId },
        select: { id: true, requiresAuthorization: true, defaultAccountId: true },
      });

      const methodMap = new Map(methods.map((m) => [m.id, m]));
      for (const payment of payments) {
        const method = methodMap.get(payment.paymentMethodId);
        if (!method) {
          throw new BadRequestException(
            `Forma de pagamento ${payment.paymentMethodId} não encontrada`,
          );
        }
        if (method.requiresAuthorization && !payment.authorizationCode) {
          throw new BadRequestException(
            'Código de autorização é obrigatório para pagamentos com cartão',
          );
        }
        // Resolve financialAccountId from method default if not provided
        if (!payment.financialAccountId && method.defaultAccountId) {
          payment.financialAccountId = method.defaultAccountId;
        }
      }

      // Validate payment conditions if provided
      const conditionIds = payments
        .filter((p) => p.paymentConditionId)
        .map((p) => p.paymentConditionId!);
      if (conditionIds.length > 0) {
        const conditions = await this.prisma.paymentCondition.findMany({
          where: { id: { in: conditionIds }, tenantId },
          select: { id: true, installments: true },
        });
        const conditionMap = new Map(conditions.map((c) => [c.id, c]));
        for (const payment of payments) {
          if (payment.paymentConditionId && !conditionMap.has(payment.paymentConditionId)) {
            throw new BadRequestException(
              `Condição de pagamento ${payment.paymentConditionId} não encontrada`,
            );
          }
          // Default installments from condition if not specified
          if (payment.paymentConditionId && !payment.installments) {
            const cond = conditionMap.get(payment.paymentConditionId);
            if (cond) payment.installments = cond.installments;
          }
        }
      }
    }

    // Create order in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          status: isCounterSale ? 'COMPLETED' : 'PENDING',
          origin: (dto.origin as any) || 'MANUAL',
          customerId: dto.customerId || null,
          salesChannelId: dto.salesChannelId,
          sellerId: dto.sellerId ?? userId,
          subtotal,
          discount: orderDiscount,
          shippingCost: isCounterSale ? 0 : shippingCost,
          totalAmount: finalTotal,
          shippingMethod: isCounterSale ? null : dto.shippingMethod,
          shippingAddress: isCounterSale ? undefined : (dto.shippingAddress as any),
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          items: {
            create: itemsData,
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: isCounterSale ? 'COMPLETED' : 'PENDING',
              notes: isCounterSale ? 'Venda no balcão' : 'Order created',
              changedBy: userId,
            },
          },
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true } },
          statusHistory: true,
        },
      });

      // Create OrderPayment records
      if (payments.length > 0) {
        await tx.orderPayment.createMany({
          data: payments.map((p) => ({
            tenantId,
            orderId: created.id,
            paymentMethodId: p.paymentMethodId,
            paymentConditionId: p.paymentConditionId || null,
            financialAccountId: p.financialAccountId || null,
            amount: p.amount,
            installments: p.installments ?? 1,
            authorizationCode: p.authorizationCode || null,
          })),
        });
      }

      return created;
    });

    if (isCounterSale) {
      // Counter sale: deduct stock directly and create receivable via event
      this.eventEmitter.emit(
        'order.counter_sale',
        new OrderCounterSaleEvent(
          order.id,
          tenantId,
          userId,
          Number(order.totalAmount),
          order.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        ),
      );
      this.logger.log(`Counter sale created: ${order.orderNumber} (${order.id}) for tenant ${tenantId}`);
    } else {
      // Regular order: stock reservation happens on confirmation
      this.eventEmitter.emit(
        'order.created',
        new OrderCreatedEvent(order.id, tenantId, userId, order.items),
      );
      this.logger.log(`Order created: ${order.orderNumber} (${order.id}) for tenant ${tenantId}`);
    }

    return order;
  }

  /**
   * Transition order status with state machine validation.
   */
  async updateStatus(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const currentStatus = order.status;
    const newStatus = dto.status;

    // Validate transition
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
      );
    }

    // Validate sufficient available stock before confirming
    if (newStatus === 'CONFIRMED') {
      await this.validateStockForConfirmation(tenantId, order.items);
    }

    const additionalData: Record<string, unknown> = {};
    if (newStatus === 'SHIPPED') {
      additionalData.shippedAt = new Date();
    }
    if (newStatus === 'DELIVERED') {
      additionalData.deliveredAt = new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: newStatus as OrderStatus,
          ...additionalData,
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: currentStatus,
          toStatus: newStatus as OrderStatus,
          notes: dto.notes,
          changedBy: userId,
        },
      });

      return updatedOrder;
    });

    // Emit appropriate events
    if (newStatus === 'CONFIRMED') {
      this.eventEmitter.emit(
        'order.confirmed',
        new OrderConfirmedEvent(
          order.id,
          tenantId,
          userId,
          Number(order.totalAmount),
          order.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        ),
      );
    }
    if (newStatus === 'SHIPPED') {
      this.eventEmitter.emit(
        'order.shipped',
        new OrderShippedEvent(order.id, tenantId),
      );
    }
    if (newStatus === 'DELIVERED') {
      this.eventEmitter.emit(
        'order.delivered',
        new OrderDeliveredEvent(order.id, tenantId),
      );
    }

    this.logger.log(`Order ${order.orderNumber} status: ${currentStatus} -> ${newStatus}`);
    return updated;
  }

  /**
   * Cancel an order with reason, release reserved stock.
   */
  async cancel(
    tenantId: string,
    id: string,
    userId: string,
    dto: CancelOrderDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowedTransitions = ORDER_STATUS_TRANSITIONS[order.status] || [];
    if (!allowedTransitions.includes('CANCELLED')) {
      throw new BadRequestException(
        `Cannot cancel order in status ${order.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true } },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          notes: dto.reason,
          changedBy: userId,
        },
      });

      return updatedOrder;
    });

    // Emit cancellation event (stock release happens in event handler, only if was confirmed+)
    this.eventEmitter.emit(
      'order.cancelled',
      new OrderCancelledEvent(order.id, tenantId, userId, order.items, dto.reason, order.status),
    );

    this.logger.log(`Order ${order.orderNumber} cancelled by ${userId}`);
    return updated;
  }

  /**
   * Get order status timeline.
   */
  async getTimeline(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const history = await this.prisma.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
    });

    return history;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  /**
   * Validate that there is sufficient available stock for all order items.
   */
  private async validateStockForConfirmation(
    tenantId: string,
    items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
  ): Promise<void> {
    const insufficientItems: string[] = [];

    for (const item of items) {
      const inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: {
          tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          available: { gte: item.quantity },
        },
        include: { product: { select: { name: true, sku: true } } },
      });

      if (!inventoryItem) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, sku: true },
        });
        insufficientItems.push(
          `${product?.name ?? item.productId} (${product?.sku ?? 'N/A'}): ${item.quantity} required`,
        );
      }
    }

    if (insufficientItems.length > 0) {
      throw new BadRequestException(
        `Estoque insuficiente para confirmar o pedido: ${insufficientItems.join('; ')}`,
      );
    }
  }

  /**
   * Generate sequential order number per tenant (e.g. PED-000001).
   */
  private async generateOrderNumber(tenantId: string): Promise<string> {
    const lastOrder = await this.prisma.order.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });

    let nextNumber = 1;
    if (lastOrder?.orderNumber) {
      const match = lastOrder.orderNumber.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `PED-${nextNumber.toString().padStart(6, '0')}`;
  }
}

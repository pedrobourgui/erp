import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ExchangeOrderItemDto } from '../dto/exchange-order-item.dto';

type Tx = Prisma.TransactionClient;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Troca de item de pedido (SCRUM-21): substitui um OrderItem por outro
 * produto/variante ajustando o estoque (estorno do devolvido + baixa do novo),
 * apurando a diferença financeira e registrando o histórico — tudo em uma
 * única transação Prisma atômica.
 */
@Injectable()
export class ExchangeOrderItemUseCase {
  private readonly logger = new Logger(ExchangeOrderItemUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    tenantId: string,
    orderId: string,
    userId: string,
    dto: ExchangeOrderItemDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const oldItem = order.items.find((i) => i.id === dto.orderItemId);
    if (!oldItem) {
      throw new NotFoundException('Item do pedido não encontrado');
    }

    const qty = dto.quantity ?? oldItem.quantity;

    const newProduct = await this.prisma.product.findFirst({
      where: { id: dto.newProductId, tenantId, deletedAt: null },
      select: { id: true, sku: true, name: true, salePrice: true, ncm: true },
    });
    if (!newProduct) throw new NotFoundException('Novo produto não encontrado');

    let variant: { id: string; sku: string; name: string; salePrice: Prisma.Decimal | null } | null =
      null;
    if (dto.newVariantId) {
      variant = await this.prisma.productVariant.findFirst({
        where: { id: dto.newVariantId, productId: newProduct.id },
        select: { id: true, sku: true, name: true, salePrice: true },
      });
      if (!variant) {
        throw new BadRequestException('Variante não pertence ao produto informado');
      }
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { isDefault: 'desc' },
      select: { id: true },
    });
    if (!warehouse) {
      throw new BadRequestException('Nenhum depósito ativo para registrar a troca');
    }

    const newStock = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        productId: newProduct.id,
        variantId: dto.newVariantId ?? null,
        available: { gte: qty },
      },
      orderBy: { warehouse: { isDefault: 'desc' } },
      select: { id: true, warehouseId: true },
    });
    if (!newStock) {
      throw new BadRequestException(
        'Estoque insuficiente para o novo item da troca',
      );
    }

    const newUnitPrice = Number(variant?.salePrice ?? newProduct.salePrice);
    const newLineTotal = round2(newUnitPrice * qty);
    const oldLineTotal = Number(oldItem.totalPrice);
    const difference = round2(newLineTotal - oldLineTotal);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.issueNewItem(tx, tenantId, orderId, userId, dto, qty, newStock);
      await this.returnOldItem(tx, tenantId, orderId, userId, oldItem, qty, warehouse.id);

      await tx.orderItem.update({
        where: { id: oldItem.id },
        data: {
          productId: newProduct.id,
          variantId: dto.newVariantId ?? null,
          sku: variant?.sku ?? newProduct.sku,
          name: variant?.name ?? newProduct.name,
          quantity: qty,
          unitPrice: newUnitPrice,
          totalPrice: newLineTotal,
          ncm: newProduct.ncm ?? null,
        },
      });

      const totals = await this.recomputeOrderTotals(tx, order, orderId);
      const financial = await this.recordDifference(tx, tenantId, order, oldItem.id, difference);

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          changedBy: userId,
          notes:
            dto.notes ??
            `Troca: ${oldItem.name} → ${variant?.name ?? newProduct.name} (qtd ${qty}); ` +
              `diferença ${difference >= 0 ? '+' : ''}${difference.toFixed(2)}`,
        },
      });

      return { ...totals, financial };
    });

    this.logger.log(
      `Exchange on order ${order.orderNumber}: item ${oldItem.id} -> product ${newProduct.id} (diff ${difference}) tenant ${tenantId}`,
    );

    return {
      orderId,
      exchangedItemId: oldItem.id,
      newProductId: newProduct.id,
      newVariantId: dto.newVariantId ?? null,
      quantity: qty,
      oldLineTotal,
      newLineTotal,
      difference,
      differenceKind:
        difference > 0 ? 'RECEIVABLE' : difference < 0 ? 'PAYABLE' : 'NONE',
      subtotal: result.subtotal,
      totalAmount: result.totalAmount,
      financialEntryId: result.financial?.id ?? null,
    };
  }

  /** Baixa (EXIT/SALE) do novo item. */
  private async issueNewItem(
    tx: Tx,
    tenantId: string,
    orderId: string,
    userId: string,
    dto: ExchangeOrderItemDto,
    qty: number,
    newStock: { id: string; warehouseId: string },
  ) {
    await tx.inventoryItem.update({
      where: { id: newStock.id },
      data: { quantity: { decrement: qty }, available: { decrement: qty } },
    });
    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: dto.newProductId,
        variantId: dto.newVariantId ?? null,
        type: 'EXIT',
        reason: 'SALE',
        quantity: qty,
        fromWarehouseId: newStock.warehouseId,
        referenceType: 'order_exchange',
        referenceId: orderId,
        notes: 'Troca - saída do novo item',
        userId,
      },
    });
  }

  /** Estorno (ENTRY/RETURN_CUSTOMER) do item devolvido. */
  private async returnOldItem(
    tx: Tx,
    tenantId: string,
    orderId: string,
    userId: string,
    oldItem: { productId: string; variantId: string | null },
    qty: number,
    warehouseId: string,
  ) {
    const existing = await tx.inventoryItem.findFirst({
      where: {
        tenantId,
        productId: oldItem.productId,
        variantId: oldItem.variantId ?? null,
        warehouseId,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.inventoryItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: qty }, available: { increment: qty } },
      });
    } else {
      await tx.inventoryItem.create({
        data: {
          tenantId,
          productId: oldItem.productId,
          variantId: oldItem.variantId ?? null,
          warehouseId,
          quantity: qty,
          available: qty,
          reserved: 0,
        },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        tenantId,
        productId: oldItem.productId,
        variantId: oldItem.variantId ?? null,
        type: 'RETURN',
        reason: 'RETURN_CUSTOMER',
        quantity: qty,
        toWarehouseId: warehouseId,
        referenceType: 'order_exchange',
        referenceId: orderId,
        notes: 'Troca - estorno do item devolvido',
        userId,
      },
    });
  }

  private async recomputeOrderTotals(
    tx: Tx,
    order: { discount: Prisma.Decimal; shippingCost: Prisma.Decimal },
    orderId: string,
  ) {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { totalPrice: true },
    });
    const subtotal = round2(
      items.reduce((sum, i) => sum + Number(i.totalPrice), 0),
    );
    const totalAmount = round2(
      subtotal - Number(order.discount) + Number(order.shippingCost),
    );
    await tx.order.update({
      where: { id: orderId },
      data: { subtotal, totalAmount },
    });
    return { subtotal, totalAmount };
  }

  /** Lançamento da diferença: cobrança (a receber) ou devolução (a pagar). */
  private async recordDifference(
    tx: Tx,
    tenantId: string,
    order: { orderNumber: string; customerId: string | null },
    orderItemId: string,
    difference: number,
  ): Promise<{ id: string } | null> {
    if (difference > 0) {
      return tx.accountsReceivable.create({
        data: {
          tenantId,
          customerId: order.customerId,
          description: `Diferença de troca - ${order.orderNumber}`,
          amount: difference,
          status: 'PENDING',
          dueDate: new Date(),
          metadata: { exchange: true, orderItemId },
        },
        select: { id: true },
      });
    }
    if (difference < 0) {
      return tx.accountsPayable.create({
        data: {
          tenantId,
          description: `Devolução de troca - ${order.orderNumber}`,
          amount: Math.abs(difference),
          status: 'PENDING',
          dueDate: new Date(),
          metadata: { exchange: true, orderItemId },
        },
        select: { id: true },
      });
    }
    return null;
  }
}

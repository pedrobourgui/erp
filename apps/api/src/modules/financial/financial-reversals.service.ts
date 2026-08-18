import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FinancialStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { startOfDayInTz } from '../../common/utils/date-range.util';
import { subtractMoney, toMoney } from '../../common/utils/money.util';
import {
  DeleteFinancialEntryDto,
  ReverseSettlementDto,
  UpdateFinancialEntryDto,
} from './dto/reverse-settlement.dto';

/** `referenceType` of the transactions this service can reverse. */
const SETTLEMENT_REFERENCES = ['receivable', 'payable'];

/** `referenceType` written on the mirrored transaction. */
const REVERSAL_REFERENCE = 'reversal';

interface TituloRow {
  id: string;
  description: string;
  amount: Prisma.Decimal | number;
  paidAmount: Prisma.Decimal | number;
  status: FinancialStatus;
  dueDate: Date;
  /** Sales order that generated a receivable. */
  orderId?: string | null;
  /** Purchase order that generated a payable. */
  purchaseOrderId?: string | null;
  deletedAt: Date | null;
}

const RECEIVABLE_SELECT = {
  id: true,
  description: true,
  amount: true,
  paidAmount: true,
  status: true,
  dueDate: true,
  orderId: true,
  deletedAt: true,
} as const;

const PAYABLE_SELECT = {
  id: true,
  description: true,
  amount: true,
  paidAmount: true,
  status: true,
  dueDate: true,
  purchaseOrderId: true,
  deletedAt: true,
} as const;

export interface ReversalResult {
  tituloId: string;
  settlementId: string;
  reversalTransactionId: string;
  amount: number;
  paidAmount: number;
  status: FinancialStatus;
  accountId: string;
}

/**
 * FN-04 — reversibility of the financial module.
 *
 * Before this, a settlement booked with the wrong amount or against the wrong
 * account could only be corrected in the database: the controller exposed
 * `GET`, `POST` and `POST /:id/settle` and nothing else. That is not acceptable
 * in a financial ERP — every posting has to be correctable *on the record*.
 *
 * The rules that shape this service:
 *
 * 1. **A reversal never erases.** The original transaction stays and a mirrored
 *    one is created next to it. Deleting would hide from the operator that the
 *    money moved twice, and would break any reconciliation already done.
 * 2. **A título born from an order is not editable here.** It belongs to the
 *    order's lifecycle (lote 2) — editing it behind the order's back is exactly
 *    the divergence that lote 2 spent its budget removing.
 * 3. **Everything carries a reason and a user**, into the audit trail.
 */
@Injectable()
export class FinancialReversalsService {
  private readonly logger = new Logger(FinancialReversalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Reverse a settlement ─────────────────────────────────────────────

  async reverseSettlement(
    tenantId: string,
    userId: string,
    tituloId: string,
    settlementId: string,
    dto: ReverseSettlementDto,
  ): Promise<ReversalResult> {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Informe o motivo do estorno');
    }

    const settlement = await this.prisma.financialTransaction.findFirst({
      where: { id: settlementId, tenantId },
    });
    if (!settlement) {
      throw new NotFoundException(
        `Baixa ${settlementId} não encontrada para o tenant ${tenantId}`,
      );
    }

    if (!SETTLEMENT_REFERENCES.includes(settlement.referenceType ?? '')) {
      throw new BadRequestException(
        'Somente a baixa de um título pode ser estornada por aqui. Uma venda é estornada pelo pedido.',
      );
    }

    if (settlement.referenceId !== tituloId) {
      throw new BadRequestException(
        'Esta baixa não pertence ao título informado',
      );
    }

    const alreadyReversed = readMetadata(settlement.metadata).reversedBy;
    if (alreadyReversed) {
      throw new ConflictException(
        'Esta baixa já foi estornada e não pode ser estornada de novo',
      );
    }

    const isReceivable = settlement.referenceType === 'receivable';
    const titulo = await this.loadTitulo(tenantId, tituloId, isReceivable);

    const settledAmount = toMoney(settlement.amount);
    const paidAmount = Math.max(
      subtractMoney(titulo.paidAmount, settledAmount),
      0,
    );
    const faceAmount = toMoney(titulo.amount);
    // Back to PENDING when nothing is left settled; the nightly job (FN-03)
    // takes it to OVERDUE again if the due date has already passed.
    const status: FinancialStatus = paidAmount <= 0 ? 'PENDING' : 'PARTIALLY_PAID';

    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.financialAccount.update({
        where: { id: settlement.accountId },
        data: {
          // Mirror of the settlement: money that came in goes back out.
          balance: isReceivable
            ? { decrement: settledAmount }
            : { increment: settledAmount },
        },
        select: { balance: true },
      });

      const reversal = await tx.financialTransaction.create({
        data: {
          tenantId,
          accountId: settlement.accountId,
          type: isReceivable ? 'DEBIT' : 'CREDIT',
          amount: settledAmount,
          balanceAfter: account.balance,
          description: `Estorno de baixa - ${titulo.description}`,
          chartAccountId: settlement.chartAccountId,
          referenceType: REVERSAL_REFERENCE,
          referenceId: settlementId,
          metadata: {
            reversalOf: settlementId,
            tituloId,
            reason,
            reversedByUserId: userId,
          },
        },
      });

      await tx.financialTransaction.update({
        where: { id: settlementId },
        data: {
          metadata: {
            ...readMetadata(settlement.metadata),
            reversedBy: reversal.id,
            reversedAt: new Date().toISOString(),
            reversedByUserId: userId,
            reversalReason: reason,
          },
        },
      });

      const data = {
        paidAmount,
        status,
        paidAt: status === 'PENDING' ? null : undefined,
      };
      if (isReceivable) {
        await tx.accountsReceivable.update({ where: { id: tituloId }, data });
      } else {
        await tx.accountsPayable.update({ where: { id: tituloId }, data });
      }

      return { reversalId: reversal.id };
    });

    await this.audit.record({
      tenantId,
      userId,
      entity: 'FinancialTransaction',
      entityId: settlementId,
      action: 'UPDATE',
      oldData: { paidAmount: toMoney(titulo.paidAmount), status: titulo.status },
      newData: { paidAmount, status },
      metadata: { reason, reversalTransactionId: result.reversalId, tituloId },
    });

    this.logger.log(
      `Reversed settlement ${settlementId} of ${settledAmount} on título ${tituloId} (tenant ${tenantId}, user ${userId})`,
    );

    return {
      tituloId,
      settlementId,
      reversalTransactionId: result.reversalId,
      amount: faceAmount,
      paidAmount,
      status,
      accountId: settlement.accountId,
    };
  }

  // ─── Settlement history ────────────────────────────────────────────────

  /**
   * The settlements of a título, so the UI can offer "estornar" on the right
   * one. A título settled three times has three reversible postings — picking
   * "the last one" for the user would be guessing.
   */
  async listSettlements(tenantId: string, tituloId: string) {
    const rows = await this.prisma.financialTransaction.findMany({
      where: {
        tenantId,
        referenceId: tituloId,
        referenceType: { in: SETTLEMENT_REFERENCES },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => {
      const metadata = readMetadata(row.metadata);
      return {
        id: row.id,
        amount: toMoney(row.amount),
        accountId: row.accountId,
        description: row.description,
        settledAt: row.createdAt,
        isReversed: !!metadata.reversedBy,
        reversedAt: (metadata.reversedAt as string) ?? null,
        reversalReason: (metadata.reversalReason as string) ?? null,
      };
    });
  }

  // ─── Edit ──────────────────────────────────────────────────────────────

  async update(
    tenantId: string,
    userId: string,
    tituloId: string,
    dto: UpdateFinancialEntryDto,
  ) {
    const { titulo, isReceivable } = await this.findTitulo(tenantId, tituloId);
    this.assertNotFromOrder(titulo);

    const hasSettlement = toMoney(titulo.paidAmount) > 0;
    const changesValue = dto.amount !== undefined || dto.dueDate !== undefined;
    if (hasSettlement && changesValue) {
      throw new ConflictException(
        'Este título já tem baixa: só descrição e categoria podem ser editadas. Estorne a baixa para alterar valor ou vencimento.',
      );
    }

    const data: Prisma.AccountsReceivableUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.chartAccountId !== undefined) {
      data.chartAccount = dto.chartAccountId
        ? { connect: { id: dto.chartAccountId } }
        : { disconnect: true };
    }
    if (dto.amount !== undefined) data.amount = toMoney(dto.amount);
    // A due date the user picked is a civil date (lote 3), never `new Date(x)`.
    if (dto.dueDate !== undefined) data.dueDate = startOfDayInTz(dto.dueDate);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar');
    }

    await this.prisma.$transaction(async (tx) => {
      if (isReceivable) {
        await tx.accountsReceivable.update({ where: { id: tituloId }, data });
      } else {
        await tx.accountsPayable.update({
          where: { id: tituloId },
          data: data as Prisma.AccountsPayableUpdateInput,
        });
      }
    });

    await this.audit.record({
      tenantId,
      userId,
      entity: isReceivable ? 'AccountsReceivable' : 'AccountsPayable',
      entityId: tituloId,
      action: 'UPDATE',
      oldData: {
        description: titulo.description,
        amount: toMoney(titulo.amount),
        dueDate: titulo.dueDate.toISOString(),
      },
      newData: dto as unknown as Prisma.InputJsonValue,
    });

    return { id: tituloId, updated: Object.keys(data) };
  }

  // ─── Soft delete ───────────────────────────────────────────────────────

  async remove(
    tenantId: string,
    userId: string,
    tituloId: string,
    dto: DeleteFinancialEntryDto,
  ) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Informe o motivo da exclusão');
    }

    const { titulo, isReceivable } = await this.findTitulo(tenantId, tituloId);
    this.assertNotFromOrder(titulo);

    if (toMoney(titulo.paidAmount) > 0) {
      throw new ConflictException(
        'Este título já tem baixa e não pode ser excluído. Estorne a baixa primeiro.',
      );
    }

    const data = {
      deletedAt: new Date(),
      status: 'CANCELLED' as FinancialStatus,
    };

    await this.prisma.$transaction(async (tx) => {
      if (isReceivable) {
        await tx.accountsReceivable.update({ where: { id: tituloId }, data });
      } else {
        await tx.accountsPayable.update({ where: { id: tituloId }, data });
      }
    });

    await this.audit.record({
      tenantId,
      userId,
      entity: isReceivable ? 'AccountsReceivable' : 'AccountsPayable',
      entityId: tituloId,
      action: 'DELETE',
      oldData: {
        description: titulo.description,
        amount: toMoney(titulo.amount),
        status: titulo.status,
      },
      metadata: { reason },
    });

    this.logger.log(
      `Soft deleted título ${tituloId} (tenant ${tenantId}, user ${userId}): ${reason}`,
    );

    return { id: tituloId, deleted: true };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async loadTitulo(
    tenantId: string,
    tituloId: string,
    isReceivable: boolean,
  ): Promise<TituloRow> {
    const titulo = isReceivable
      ? await this.prisma.accountsReceivable.findFirst({
          where: { id: tituloId, tenantId },
          select: RECEIVABLE_SELECT,
        })
      : await this.prisma.accountsPayable.findFirst({
          where: { id: tituloId, tenantId },
          select: PAYABLE_SELECT,
        });

    if (!titulo) {
      throw new NotFoundException(
        `Título ${tituloId} não encontrado para o tenant ${tenantId}`,
      );
    }
    return titulo as TituloRow;
  }

  /** A título id is either a receivable or a payable — the caller rarely knows which. */
  private async findTitulo(tenantId: string, tituloId: string) {
    const receivable = await this.prisma.accountsReceivable.findFirst({
      where: { id: tituloId, tenantId },
      select: RECEIVABLE_SELECT,
    });
    if (receivable) return { titulo: receivable as TituloRow, isReceivable: true };

    const payable = await this.prisma.accountsPayable.findFirst({
      where: { id: tituloId, tenantId },
      select: PAYABLE_SELECT,
    });
    if (payable) return { titulo: payable as TituloRow, isReceivable: false };

    throw new NotFoundException(
      `Título ${tituloId} não encontrado para o tenant ${tenantId}`,
    );
  }

  /**
   * A título with a document behind it belongs to that document's lifecycle.
   *
   * Editing it here would recreate the divergence lote 2 spent its budget
   * removing: the order says one thing, the financial module another.
   */
  private assertNotFromOrder(titulo: TituloRow): void {
    if (titulo.orderId) {
      throw new ConflictException(
        'Este título foi gerado por um pedido: altere-o pelo próprio pedido (cancelamento ou estorno da venda).',
      );
    }
    if (titulo.purchaseOrderId) {
      throw new ConflictException(
        'Este título foi gerado por uma ordem de compra: altere-o pela própria compra.',
      );
    }
  }
}

function readMetadata(metadata: Prisma.JsonValue): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

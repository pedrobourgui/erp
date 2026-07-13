import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, FinancialStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  SettleFinancialEntryDto,
  SettleableKind,
} from './dto/settle-financial-entry.dto';

/** Statuses a título can be settled from. */
const SETTLEABLE_STATUSES: FinancialStatus[] = [
  'PENDING',
  'PARTIALLY_PAID',
  'OVERDUE',
];

/** Cent-level tolerance for float comparisons on money. */
const EPSILON = 0.005;

export interface SettlementResult {
  kind: SettleableKind;
  id: string;
  status: FinancialStatus;
  amount: number;
  paidAmount: number;
  settledAmount: number;
  accountId: string;
  transactionId: string;
}

/**
 * Settlement (baixa) of open títulos — SCRUM-31/32.
 *
 * A term sale (boleto, credit card…) parks its money in an AccountsReceivable;
 * only the settlement moves it into a FinancialAccount. Immediate payments
 * (cash/PIX/debit) never pass through here — they are credited at the sale and
 * their título is already born PAID.
 */
@Injectable()
export class FinancialSettlementsService {
  private readonly logger = new Logger(FinancialSettlementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async settle(
    tenantId: string,
    id: string,
    dto: SettleFinancialEntryDto,
  ): Promise<SettlementResult> {
    const isReceivable = dto.kind === 'RECEIVABLE';

    const titulo = isReceivable
      ? await this.loadReceivable(tenantId, id)
      : await this.loadPayable(tenantId, id);

    if (!SETTLEABLE_STATUSES.includes(titulo.status)) {
      throw new ConflictException(
        `Título ${id} não pode ser baixado (status atual: ${titulo.status})`,
      );
    }

    const accountId = await this.resolveAccountId(tenantId, titulo, dto.accountId);

    const amount = Number(titulo.amount);
    const alreadyPaid = Number(titulo.paidAmount);
    const outstanding = round2(amount - alreadyPaid);

    const settledAmount = dto.amount != null ? round2(dto.amount) : outstanding;
    if (settledAmount <= 0 || settledAmount > outstanding + EPSILON) {
      throw new BadRequestException(
        `Valor da baixa (${settledAmount.toFixed(2)}) deve ser maior que zero e no máximo o saldo em aberto (${outstanding.toFixed(2)})`,
      );
    }

    const paidAmount = round2(alreadyPaid + settledAmount);
    const isFullyPaid = paidAmount >= amount - EPSILON;
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const transaction = await this.prisma.$transaction(async (tx) => {
      const account = await tx.financialAccount.update({
        where: { id: accountId },
        data: {
          balance: isReceivable
            ? { increment: settledAmount }
            : { decrement: settledAmount },
        },
        select: { balance: true },
      });

      const data = {
        paidAmount,
        status: (isFullyPaid ? 'PAID' : 'PARTIALLY_PAID') as FinancialStatus,
        paidAt: isFullyPaid ? paidAt : null,
      };

      if (isReceivable) {
        await tx.accountsReceivable.update({ where: { id }, data });
      } else {
        await tx.accountsPayable.update({ where: { id }, data });
      }

      return tx.financialTransaction.create({
        data: {
          tenantId,
          accountId,
          type: isReceivable ? 'CREDIT' : 'DEBIT',
          amount: settledAmount,
          balanceAfter: account.balance,
          description: `${isReceivable ? 'Recebimento' : 'Pagamento'} - ${titulo.description}`,
          chartAccountId: titulo.chartAccountId,
          referenceType: isReceivable ? 'receivable' : 'payable',
          referenceId: id,
          createdAt: paidAt,
        },
      });
    });

    this.logger.log(
      `Settled ${dto.kind} ${id}: ${settledAmount} on account ${accountId} (tenant ${tenantId})`,
    );

    return {
      kind: dto.kind,
      id,
      status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
      amount,
      paidAmount,
      settledAmount,
      accountId,
      transactionId: transaction.id,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private async loadReceivable(tenantId: string, id: string) {
    const receivable = await this.prisma.accountsReceivable.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        description: true,
        amount: true,
        paidAmount: true,
        status: true,
        chartAccountId: true,
        metadata: true,
        orderPayment: {
          select: {
            financialAccountId: true,
            paymentMethod: { select: { defaultAccountId: true } },
          },
        },
        paymentMethod: { select: { defaultAccountId: true } },
      },
    });

    if (!receivable) {
      throw new NotFoundException(
        `Receivable with id ${id} not found for tenant ${tenantId}`,
      );
    }
    return receivable;
  }

  private async loadPayable(tenantId: string, id: string) {
    const payable = await this.prisma.accountsPayable.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        description: true,
        amount: true,
        paidAmount: true,
        status: true,
        chartAccountId: true,
        metadata: true,
        paymentMethod: { select: { defaultAccountId: true } },
      },
    });

    if (!payable) {
      throw new NotFoundException(
        `Payable with id ${id} not found for tenant ${tenantId}`,
      );
    }
    return { ...payable, orderPayment: null };
  }

  /**
   * Where the money lands: the account chosen by the caller, else the one the
   * sale recorded on its payment, else the payment method's default, else the
   * account a manual entry was booked against.
   */
  private async resolveAccountId(
    tenantId: string,
    titulo: {
      metadata: Prisma.JsonValue;
      orderPayment: {
        financialAccountId: string | null;
        paymentMethod: { defaultAccountId: string | null } | null;
      } | null;
      paymentMethod: { defaultAccountId: string | null } | null;
    },
    requestedAccountId?: string,
  ): Promise<string> {
    if (requestedAccountId) {
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: requestedAccountId, tenantId },
        select: { id: true },
      });
      if (!account) {
        throw new NotFoundException(
          `Financial account with id ${requestedAccountId} not found for tenant ${tenantId}`,
        );
      }
      return account.id;
    }

    const resolved =
      titulo.orderPayment?.financialAccountId ??
      titulo.orderPayment?.paymentMethod?.defaultAccountId ??
      titulo.paymentMethod?.defaultAccountId ??
      readAccountIdFromMetadata(titulo.metadata);

    if (!resolved) {
      throw new BadRequestException(
        'Não há conta financeira vinculada a este título. Informe a conta para registrar a baixa.',
      );
    }
    return resolved;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function readAccountIdFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).financialAccountId;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

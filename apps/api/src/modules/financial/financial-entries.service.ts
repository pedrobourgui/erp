import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, FinancialStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateFinancialEntryDto,
  FinancialEntryQueryDto,
  FinancialEntryType,
} from './dto/financial-entry.dto';
import {
  PaginatedResponse,
  buildPaginatedResponse,
} from '../../common/utils/pagination';

const OPEN_STATUSES: FinancialStatus[] = [
  'PENDING',
  'PARTIALLY_PAID',
  'OVERDUE',
];

/** Unified list item (SCRUM-11). */
export interface FinancialEntry {
  id: string;
  kind: 'TRANSACTION' | 'RECEIVABLE' | 'PAYABLE';
  type: FinancialEntryType;
  description: string;
  amount: number;
  date: Date;
  status: 'PAID' | 'PENDING' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
  accountId: string | null;
  accountName: string | null;
  chartAccountId: string | null;
  categoryName: string | null;
}

export interface FinancialEntriesTotals {
  revenue: number;
  expense: number;
  balance: number;
}

@Injectable()
export class FinancialEntriesService {
  private readonly logger = new Logger(FinancialEntriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Create (SCRUM-10) ──────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateFinancialEntryDto) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.accountId, tenantId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException(
        `Financial account with id ${dto.accountId} not found for tenant ${tenantId}`,
      );
    }

    if (dto.chartAccountId) {
      const chart = await this.prisma.chartOfAccounts.findFirst({
        where: { id: dto.chartAccountId, tenantId },
        select: { id: true },
      });
      if (!chart) {
        throw new NotFoundException(
          `Chart of accounts with id ${dto.chartAccountId} not found for tenant ${tenantId}`,
        );
      }
    }

    const paid = dto.paid ?? true;
    const isRevenue = dto.type === 'REVENUE';
    const amount = dto.amount;
    const date = new Date(dto.date);
    const description =
      dto.description?.trim() || (isRevenue ? 'Receita manual' : 'Despesa manual');

    if (!paid && !dto.dueDate) {
      throw new BadRequestException(
        'dueDate is required for a term (a prazo) entry',
      );
    }

    if (paid) {
      return this.createCashEntry(tenantId, {
        accountId: dto.accountId,
        chartAccountId: dto.chartAccountId,
        isRevenue,
        amount,
        date,
        description,
      });
    }

    return this.createTermEntry(tenantId, {
      accountId: dto.accountId,
      chartAccountId: dto.chartAccountId,
      isRevenue,
      amount,
      dueDate: new Date(dto.dueDate as string),
      description,
    });
  }

  private async createCashEntry(
    tenantId: string,
    input: {
      accountId: string;
      chartAccountId?: string;
      isRevenue: boolean;
      amount: number;
      date: Date;
      description: string;
    },
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.financialAccount.update({
        where: { id: input.accountId },
        data: {
          balance: input.isRevenue
            ? { increment: input.amount }
            : { decrement: input.amount },
        },
        select: { balance: true },
      });

      return tx.financialTransaction.create({
        data: {
          tenantId,
          accountId: input.accountId,
          type: input.isRevenue ? 'CREDIT' : 'DEBIT',
          amount: input.amount,
          balanceAfter: account.balance,
          description: input.description,
          chartAccountId: input.chartAccountId ?? null,
          referenceType: 'manual',
          createdAt: input.date,
        },
      });
    });

    this.logger.log(
      `Manual cash entry created: ${result.type} ${input.amount} on account ${input.accountId} (tenant ${tenantId})`,
    );

    return {
      kind: 'TRANSACTION' as const,
      id: result.id,
      type: input.isRevenue ? 'REVENUE' : 'EXPENSE',
      status: 'PAID',
      amount: Number(result.amount),
    };
  }

  private async createTermEntry(
    tenantId: string,
    input: {
      accountId: string;
      chartAccountId?: string;
      isRevenue: boolean;
      amount: number;
      dueDate: Date;
      description: string;
    },
  ) {
    const data = {
      tenantId,
      description: input.description,
      amount: input.amount,
      dueDate: input.dueDate,
      status: 'PENDING' as const,
      chartAccountId: input.chartAccountId ?? null,
      metadata: { manual: true, financialAccountId: input.accountId },
    };

    if (input.isRevenue) {
      const receivable = await this.prisma.accountsReceivable.create({ data });
      this.logger.log(
        `Manual receivable created: ${receivable.id} (tenant ${tenantId})`,
      );
      return {
        kind: 'RECEIVABLE' as const,
        id: receivable.id,
        type: 'REVENUE',
        status: receivable.status,
        amount: Number(receivable.amount),
      };
    }

    const payable = await this.prisma.accountsPayable.create({ data });
    this.logger.log(
      `Manual payable created: ${payable.id} (tenant ${tenantId})`,
    );
    return {
      kind: 'PAYABLE' as const,
      id: payable.id,
      type: 'EXPENSE',
      status: payable.status,
      amount: Number(payable.amount),
    };
  }

  // ─── List with filters + totals (SCRUM-11) ──────────────────────────────

  async findAll(
    tenantId: string,
    query: FinancialEntryQueryDto,
  ): Promise<PaginatedResponse<FinancialEntry> & { totals: FinancialEntriesTotals }> {
    const { page = 1, limit = 20, type, accountId, status } = query;
    const skip = (page - 1) * limit;

    const includeRevenue = !type || type === 'REVENUE';
    const includeExpense = !type || type === 'EXPENSE';
    // A FinancialTransaction is money that already moved — manual entries and
    // sales alike (SCRUM-41). A título is money still owed, so a settled one is
    // dropped from the list: its transaction already represents it, and listing
    // both would count the same money twice.
    const includeTransactions = status !== 'OPEN';
    const includeTitulos = status !== 'PAID';

    const dateRange = this.buildDateRange(query.startDate, query.endDate);
    const accountsMap = await this.loadAccountNames(tenantId);

    const txWhere = this.buildTransactionWhere(tenantId, {
      dateRange,
      includeRevenue,
      includeExpense,
      accountId,
    });
    const recWhere = this.buildReceivableWhere(tenantId, { dateRange, accountId });
    const payWhere = this.buildPayableWhere(tenantId, { dateRange, accountId });

    const fetchLimit = skip + limit;
    const [txRows, recRows, payRows, txCount, recCount, payCount] =
      await Promise.all([
        includeTransactions
          ? this.prisma.financialTransaction.findMany({
              where: txWhere,
              orderBy: { createdAt: 'desc' },
              take: fetchLimit,
              include: { chartAccount: { select: { name: true } } },
            })
          : Promise.resolve([]),
        includeTitulos && includeRevenue
          ? this.prisma.accountsReceivable.findMany({
              where: recWhere,
              orderBy: { dueDate: 'desc' },
              take: fetchLimit,
              include: {
                chartAccount: { select: { name: true } },
                orderPayment: { select: { financialAccountId: true } },
                paymentMethod: { select: { defaultAccountId: true } },
              },
            })
          : Promise.resolve([]),
        includeTitulos && includeExpense
          ? this.prisma.accountsPayable.findMany({
              where: payWhere,
              orderBy: { dueDate: 'desc' },
              take: fetchLimit,
              include: {
                chartAccount: { select: { name: true } },
                paymentMethod: { select: { defaultAccountId: true } },
              },
            })
          : Promise.resolve([]),
        includeTransactions
          ? this.prisma.financialTransaction.count({ where: txWhere })
          : Promise.resolve(0),
        includeTitulos && includeRevenue
          ? this.prisma.accountsReceivable.count({ where: recWhere })
          : Promise.resolve(0),
        includeTitulos && includeExpense
          ? this.prisma.accountsPayable.count({ where: payWhere })
          : Promise.resolve(0),
      ]);

    const merged = [
      ...txRows.map((r) => this.mapTransaction(r, accountsMap)),
      ...recRows.map((r) => this.mapReceivable(r, accountsMap)),
      ...payRows.map((r) => this.mapPayable(r, accountsMap)),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(skip, skip + limit);

    const total = txCount + recCount + payCount;
    const totals = await this.computeTotals(tenantId, {
      txWhere,
      recWhere,
      payWhere,
      includeTransactions,
      includeRevenue,
      includeExpense,
      includeTitulos,
    });

    return {
      ...buildPaginatedResponse(merged, total, { page, limit, sortOrder: 'desc' }),
      totals,
    };
  }

  private buildDateRange(startDate?: string, endDate?: string) {
    const range: { gte?: Date; lte?: Date } = {};
    if (startDate) range.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return Object.keys(range).length ? range : undefined;
  }

  private buildTransactionWhere(
    tenantId: string,
    opts: {
      dateRange?: { gte?: Date; lte?: Date };
      includeRevenue: boolean;
      includeExpense: boolean;
      accountId?: string;
    },
  ): Prisma.FinancialTransactionWhereInput {
    // No referenceType filter: manual entries, sales ('order') and settlements
    // ('receivable'/'payable') are all money that moved through an account.
    const where: Prisma.FinancialTransactionWhereInput = { tenantId };
    if (opts.dateRange) where.createdAt = opts.dateRange;
    if (opts.accountId) where.accountId = opts.accountId;
    if (opts.includeRevenue && !opts.includeExpense) where.type = 'CREDIT';
    if (opts.includeExpense && !opts.includeRevenue) where.type = 'DEBIT';
    return where;
  }

  private buildReceivableWhere(
    tenantId: string,
    opts: { dateRange?: { gte?: Date; lte?: Date }; accountId?: string },
  ): Prisma.AccountsReceivableWhereInput {
    const where: Prisma.AccountsReceivableWhereInput = {
      tenantId,
      status: { in: OPEN_STATUSES },
    };
    if (opts.dateRange) where.dueDate = opts.dateRange;
    if (opts.accountId) {
      // The account of a título is wherever it will land: the one the sale
      // recorded, the payment method's default, or the manual entry's account.
      where.OR = [
        { orderPayment: { financialAccountId: opts.accountId } },
        { paymentMethod: { defaultAccountId: opts.accountId } },
        { metadata: { path: ['financialAccountId'], equals: opts.accountId } },
      ];
    }
    return where;
  }

  private buildPayableWhere(
    tenantId: string,
    opts: { dateRange?: { gte?: Date; lte?: Date }; accountId?: string },
  ): Prisma.AccountsPayableWhereInput {
    const where: Prisma.AccountsPayableWhereInput = {
      tenantId,
      status: { in: OPEN_STATUSES },
    };
    if (opts.dateRange) where.dueDate = opts.dateRange;
    if (opts.accountId) {
      where.OR = [
        { paymentMethod: { defaultAccountId: opts.accountId } },
        { metadata: { path: ['financialAccountId'], equals: opts.accountId } },
      ];
    }
    return where;
  }

  private async computeTotals(
    tenantId: string,
    opts: {
      txWhere: Prisma.FinancialTransactionWhereInput;
      recWhere: Prisma.AccountsReceivableWhereInput;
      payWhere: Prisma.AccountsPayableWhereInput;
      includeTransactions: boolean;
      includeRevenue: boolean;
      includeExpense: boolean;
      includeTitulos: boolean;
    },
  ): Promise<FinancialEntriesTotals> {
    const [txCredit, txDebit, recSum, paySum] = await Promise.all([
      opts.includeTransactions && opts.includeRevenue
        ? this.prisma.financialTransaction.aggregate({
            where: { ...opts.txWhere, type: 'CREDIT' },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      opts.includeTransactions && opts.includeExpense
        ? this.prisma.financialTransaction.aggregate({
            where: { ...opts.txWhere, type: 'DEBIT' },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      opts.includeTitulos && opts.includeRevenue
        ? this.prisma.accountsReceivable.aggregate({
            where: opts.recWhere,
            _sum: { amount: true, paidAmount: true },
          })
        : Promise.resolve({ _sum: { amount: null, paidAmount: null } }),
      opts.includeTitulos && opts.includeExpense
        ? this.prisma.accountsPayable.aggregate({
            where: opts.payWhere,
            _sum: { amount: true, paidAmount: true },
          })
        : Promise.resolve({ _sum: { amount: null, paidAmount: null } }),
    ]);

    // An open título only counts for what is still owed — the part already
    // settled has become a FinancialTransaction and is counted there.
    const revenue =
      Number(txCredit._sum.amount ?? 0) + outstandingOf(recSum._sum);
    const expense =
      Number(txDebit._sum.amount ?? 0) + outstandingOf(paySum._sum);
    return { revenue, expense, balance: revenue - expense };
  }

  private async loadAccountNames(tenantId: string): Promise<Map<string, string>> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    return new Map(accounts.map((a) => [a.id, a.name]));
  }

  private mapTransaction(
    row: { id: string; type: string; amount: Prisma.Decimal; description: string; createdAt: Date; accountId: string; chartAccountId: string | null; chartAccount: { name: string } | null },
    accounts: Map<string, string>,
  ): FinancialEntry {
    return {
      id: row.id,
      kind: 'TRANSACTION',
      type: row.type === 'CREDIT' ? 'REVENUE' : 'EXPENSE',
      description: row.description,
      amount: Number(row.amount),
      date: row.createdAt,
      status: 'PAID',
      accountId: row.accountId,
      accountName: accounts.get(row.accountId) ?? null,
      chartAccountId: row.chartAccountId,
      categoryName: row.chartAccount?.name ?? null,
    };
  }

  private mapReceivable(
    row: TituloRow & {
      orderPayment: { financialAccountId: string | null } | null;
      paymentMethod: { defaultAccountId: string | null } | null;
    },
    accounts: Map<string, string>,
  ): FinancialEntry {
    const accountId =
      row.orderPayment?.financialAccountId ??
      row.paymentMethod?.defaultAccountId ??
      this.readAccountIdFromMetadata(row.metadata);

    return {
      id: row.id,
      kind: 'RECEIVABLE',
      type: 'REVENUE',
      description: row.description,
      amount: outstandingOf(row),
      date: row.dueDate,
      status: row.status,
      accountId,
      accountName: accountId ? accounts.get(accountId) ?? null : null,
      chartAccountId: row.chartAccountId,
      categoryName: row.chartAccount?.name ?? null,
    };
  }

  private mapPayable(
    row: TituloRow & { paymentMethod: { defaultAccountId: string | null } | null },
    accounts: Map<string, string>,
  ): FinancialEntry {
    const accountId =
      row.paymentMethod?.defaultAccountId ??
      this.readAccountIdFromMetadata(row.metadata);

    return {
      id: row.id,
      kind: 'PAYABLE',
      type: 'EXPENSE',
      description: row.description,
      amount: outstandingOf(row),
      date: row.dueDate,
      status: row.status,
      accountId,
      accountName: accountId ? accounts.get(accountId) ?? null : null,
      chartAccountId: row.chartAccountId,
      categoryName: row.chartAccount?.name ?? null,
    };
  }

  private readAccountIdFromMetadata(metadata: Prisma.JsonValue): string | null {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const value = (metadata as Record<string, unknown>).financialAccountId;
      return typeof value === 'string' ? value : null;
    }
    return null;
  }
}

interface TituloRow {
  id: string;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  description: string;
  dueDate: Date;
  status: FinancialEntry['status'];
  chartAccountId: string | null;
  chartAccount: { name: string } | null;
  metadata: Prisma.JsonValue;
}

/** What a título still owes: face value minus whatever has already been settled. */
function outstandingOf(row: {
  amount: Prisma.Decimal | number | null;
  paidAmount: Prisma.Decimal | number | null;
}): number {
  const amount = Number(row.amount ?? 0);
  const paid = Number(row.paidAmount ?? 0);
  return Math.round((amount - paid) * 100) / 100;
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, BankAccountType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateFinancialAccountDto,
  UpdateFinancialAccountDto,
  FinancialAccountQueryDto,
} from './dto/financial-account.dto';
import { TransferBetweenAccountsDto } from './dto/transfer.dto';
import {
  PaginatedResponse,
  buildPaginatedResponse,
} from '../../common/utils/pagination';

@Injectable()
export class FinancialAccountsService {
  private readonly logger = new Logger(FinancialAccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: FinancialAccountQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20, search, type, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.FinancialAccountWhereInput = { tenantId };

    if (type) where.type = type as BankAccountType;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { bankName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.financialAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          code: true,
          bankName: true,
          bankBranch: true,
          bankAccount: true,
          balance: true,
          isActive: true,
          acceptsDirectSales: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              cashRegisters: true,
              paymentMethods: true,
            },
          },
        },
      }),
      this.prisma.financialAccount.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortOrder: 'asc' });
  }

  async findOne(tenantId: string, id: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        code: true,
        bankName: true,
        bankBranch: true,
        bankAccount: true,
        balance: true,
        isActive: true,
        acceptsDirectSales: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            cashRegisters: true,
            paymentMethods: true,
            transactions: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(
        `Financial account with id ${id} not found for tenant ${tenantId}`,
      );
    }

    return account;
  }

  async create(tenantId: string, dto: CreateFinancialAccountDto) {
    const account = await this.prisma.financialAccount.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type as BankAccountType,
        code: dto.code,
        bankName: dto.bankName,
        bankBranch: dto.bankBranch,
        bankAccount: dto.bankAccount,
        acceptsDirectSales: dto.acceptsDirectSales ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(
      `Financial account created: ${account.name} (${account.id}) for tenant ${tenantId}`,
    );

    return account;
  }

  async update(tenantId: string, id: string, dto: UpdateFinancialAccountDto) {
    const existing = await this.prisma.financialAccount.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Financial account with id ${id} not found for tenant ${tenantId}`,
      );
    }

    const updateData: Prisma.FinancialAccountUncheckedUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = dto.type as BankAccountType;
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.bankName !== undefined) updateData.bankName = dto.bankName;
    if (dto.bankBranch !== undefined) updateData.bankBranch = dto.bankBranch;
    if (dto.bankAccount !== undefined) updateData.bankAccount = dto.bankAccount;
    if (dto.acceptsDirectSales !== undefined) updateData.acceptsDirectSales = dto.acceptsDirectSales;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.financialAccount.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(
      `Financial account updated: ${updated.name} (${updated.id}) for tenant ${tenantId}`,
    );

    return updated;
  }

  /**
   * Transferência entre contas — SCRUM-14.
   * Debita a origem e credita o destino atomicamente, gerando dois
   * FinancialTransaction vinculados por um transferId compartilhado.
   */
  async transfer(tenantId: string, dto: TransferBetweenAccountsDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException(
        'A conta de origem e a de destino devem ser diferentes',
      );
    }

    const amount = Math.round(dto.amount * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('O valor da transferência deve ser maior que zero');
    }

    const [from, to] = await Promise.all([
      this.prisma.financialAccount.findFirst({
        where: { id: dto.fromAccountId, tenantId },
        select: { id: true, name: true },
      }),
      this.prisma.financialAccount.findFirst({
        where: { id: dto.toAccountId, tenantId },
        select: { id: true, name: true },
      }),
    ]);

    if (!from) {
      throw new NotFoundException(
        `Financial account with id ${dto.fromAccountId} not found for tenant ${tenantId}`,
      );
    }
    if (!to) {
      throw new NotFoundException(
        `Financial account with id ${dto.toAccountId} not found for tenant ${tenantId}`,
      );
    }

    const transferId = randomUUID();
    const when = dto.date ? new Date(dto.date) : new Date();
    const description =
      dto.description?.trim() || `Transferência ${from.name} → ${to.name}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const source = await tx.financialAccount.update({
        where: { id: from.id },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      });

      const destination = await tx.financialAccount.update({
        where: { id: to.id },
        data: { balance: { increment: amount } },
        select: { balance: true },
      });

      const debit = await tx.financialTransaction.create({
        data: {
          tenantId,
          accountId: from.id,
          type: 'DEBIT',
          amount,
          balanceAfter: source.balance,
          description,
          referenceType: 'transfer',
          referenceId: transferId,
          metadata: { transferId, direction: 'out', counterpartyAccountId: to.id },
          createdAt: when,
        },
      });

      const credit = await tx.financialTransaction.create({
        data: {
          tenantId,
          accountId: to.id,
          type: 'CREDIT',
          amount,
          balanceAfter: destination.balance,
          description,
          referenceType: 'transfer',
          referenceId: transferId,
          metadata: { transferId, direction: 'in', counterpartyAccountId: from.id },
          createdAt: when,
        },
      });

      return {
        sourceBalance: source.balance,
        destinationBalance: destination.balance,
        debit,
        credit,
      };
    });

    this.logger.log(
      `Transfer ${transferId}: ${amount} from ${from.id} to ${to.id} (tenant ${tenantId})`,
    );

    return {
      transferId,
      amount,
      description,
      date: when,
      fromAccountId: from.id,
      toAccountId: to.id,
      sourceBalance: result.sourceBalance,
      destinationBalance: result.destinationBalance,
      debitTransactionId: result.debit.id,
      creditTransactionId: result.credit.id,
    };
  }
}

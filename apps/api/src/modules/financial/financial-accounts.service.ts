import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, BankAccountType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateFinancialAccountDto,
  UpdateFinancialAccountDto,
  FinancialAccountQueryDto,
} from './dto/financial-account.dto';
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
}

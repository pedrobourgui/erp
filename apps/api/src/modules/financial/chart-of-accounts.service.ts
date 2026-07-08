import { Injectable } from '@nestjs/common';
import { Prisma, AccountType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, type?: AccountType) {
    const where: Prisma.ChartOfAccountsWhereInput = { tenantId, isActive: true };
    if (type) where.type = type;

    const data = await this.prisma.chartOfAccounts.findMany({
      where,
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, type: true },
    });

    return { success: true, data };
  }
}

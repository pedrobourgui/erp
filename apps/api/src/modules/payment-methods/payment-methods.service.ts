import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, PaymentMethodType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodQueryDto,
} from './dto/payment-method.dto';
import {
  PaginatedResponse,
  buildPaginatedResponse,
  buildPrismaOrderBy,
} from '../../common/utils/pagination';

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: PaymentMethodQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20, search, type, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentMethodWhereInput = { tenantId };

    if (type) where.type = type as Prisma.EnumPaymentMethodTypeFilter;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.paymentMethod.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          defaultAccount: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      this.prisma.paymentMethod.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortOrder: 'asc' });
  }

  async findOne(tenantId: string, id: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id, tenantId },
      include: {
        defaultAccount: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!method) {
      throw new NotFoundException(
        `Payment method with id ${id} not found for tenant ${tenantId}`,
      );
    }

    return method;
  }

  async create(tenantId: string, dto: CreatePaymentMethodDto) {
    if (dto.defaultAccountId) {
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: dto.defaultAccountId, tenantId },
      });
      if (!account) {
        throw new NotFoundException(
          `Financial account ${dto.defaultAccountId} not found for tenant ${tenantId}`,
        );
      }
    }

    const method = await this.prisma.paymentMethod.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type as PaymentMethodType,
        defaultAccountId: dto.defaultAccountId,
        feePercentage: dto.feePercentage,
        settlementDays: dto.settlementDays,
        requiresAuthorization: dto.requiresAuthorization ?? false,
        fiscalCode: dto.fiscalCode,
        isActive: dto.isActive ?? true,
      },
      include: {
        defaultAccount: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    this.logger.log(
      `Payment method created: ${method.name} (${method.id}) for tenant ${tenantId}`,
    );

    return method;
  }

  async update(tenantId: string, id: string, dto: UpdatePaymentMethodDto) {
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Payment method with id ${id} not found for tenant ${tenantId}`,
      );
    }

    if (dto.defaultAccountId) {
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: dto.defaultAccountId, tenantId },
      });
      if (!account) {
        throw new NotFoundException(
          `Financial account ${dto.defaultAccountId} not found for tenant ${tenantId}`,
        );
      }
    }

    const updateData: Prisma.PaymentMethodUncheckedUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = dto.type as PaymentMethodType;
    if (dto.defaultAccountId !== undefined) updateData.defaultAccountId = dto.defaultAccountId;
    if (dto.feePercentage !== undefined) updateData.feePercentage = dto.feePercentage;
    if (dto.settlementDays !== undefined) updateData.settlementDays = dto.settlementDays;
    if (dto.requiresAuthorization !== undefined) updateData.requiresAuthorization = dto.requiresAuthorization;
    if (dto.fiscalCode !== undefined) updateData.fiscalCode = dto.fiscalCode;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.paymentMethod.update({
      where: { id },
      data: updateData,
      include: {
        defaultAccount: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    this.logger.log(
      `Payment method updated: ${updated.name} (${updated.id}) for tenant ${tenantId}`,
    );

    return updated;
  }
}

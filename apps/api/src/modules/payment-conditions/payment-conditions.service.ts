import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, PaymentConditionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreatePaymentConditionDto } from './dto/create-payment-condition.dto';
import { UpdatePaymentConditionDto } from './dto/update-payment-condition.dto';
import { PaymentConditionQueryDto } from './dto/payment-condition-query.dto';
import {
  PaginatedResponse,
  buildPaginatedResponse,
  buildPrismaOrderBy,
} from '../../common/utils/pagination';

@Injectable()
export class PaymentConditionsService {
  private readonly logger = new Logger(PaymentConditionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: PaymentConditionQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy,
      sortOrder = 'desc',
      type,
      isActive,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.PaymentConditionWhereInput = { tenantId };

    if (type) where.type = type as Prisma.EnumPaymentConditionTypeFilter;
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.paymentCondition.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildPrismaOrderBy(sortBy, sortOrder),
      }),
      this.prisma.paymentCondition.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortBy, sortOrder });
  }

  async findOne(tenantId: string, id: string) {
    const condition = await this.prisma.paymentCondition.findFirst({
      where: { id, tenantId },
    });

    if (!condition) {
      throw new NotFoundException(
        `Condição de pagamento não encontrada`,
      );
    }

    return condition;
  }

  async create(tenantId: string, dto: CreatePaymentConditionDto) {
    // Check for duplicate code in tenant
    const existing = await this.prisma.paymentCondition.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe uma condição de pagamento com o código "${dto.code}"`,
      );
    }

    const condition = await this.prisma.paymentCondition.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        type: dto.type as PaymentConditionType,
        installments: dto.installments ?? 1,
        daysBetweenInstallments: dto.daysBetweenInstallments ?? 0,
        entryPercentage: dto.entryPercentage ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(
      `Payment condition created: ${condition.name} (${condition.id}) for tenant ${tenantId}`,
    );

    return condition;
  }

  async update(tenantId: string, id: string, dto: UpdatePaymentConditionDto) {
    const existing = await this.prisma.paymentCondition.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Condição de pagamento não encontrada`,
      );
    }

    // If code is being changed, check for duplicates
    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.paymentCondition.findUnique({
        where: { tenantId_code: { tenantId, code: dto.code } },
      });

      if (duplicate) {
        throw new ConflictException(
          `Já existe uma condição de pagamento com o código "${dto.code}"`,
        );
      }
    }

    const updated = await this.prisma.paymentCondition.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.type !== undefined && { type: dto.type as PaymentConditionType }),
        ...(dto.installments !== undefined && { installments: dto.installments }),
        ...(dto.daysBetweenInstallments !== undefined && { daysBetweenInstallments: dto.daysBetweenInstallments }),
        ...(dto.entryPercentage !== undefined && { entryPercentage: dto.entryPercentage }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      } as Prisma.PaymentConditionUncheckedUpdateInput,
    });

    this.logger.log(
      `Payment condition updated: ${updated.name} (${updated.id}) for tenant ${tenantId}`,
    );

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.paymentCondition.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Condição de pagamento não encontrada`,
      );
    }

    // Soft deactivation rather than hard delete
    const updated = await this.prisma.paymentCondition.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(
      `Payment condition deactivated: ${updated.name} (${updated.id}) for tenant ${tenantId}`,
    );

    return { success: true, message: 'Payment condition deactivated' };
  }
}

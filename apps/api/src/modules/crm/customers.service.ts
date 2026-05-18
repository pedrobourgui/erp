import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
} from './dto/customer.dto';
import {
  PaginatedResponse,
  buildPaginatedResponse,
  buildPrismaOrderBy,
} from '../../common/utils/pagination';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List customers with pagination, search, and filters.
   */
  async findAll(
    tenantId: string,
    query: CustomerQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy,
      sortOrder = 'desc',
      segment,
      tag,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (segment) {
      where.segment = segment;
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { document: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { tradeName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildPrismaOrderBy(sortBy, sortOrder),
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          document: true,
          documentType: true,
          tradeName: true,
          segment: true,
          tags: true,
          score: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { orders: true },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortBy, sortOrder });
  }

  /**
   * Get a single customer by ID with addresses and recent interactions.
   */
  async findById(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
        interactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { orders: true, invoices: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente com id ${id} não encontrado`,
      );
    }

    return customer;
  }

  /**
   * Create a new customer.
   */
  async create(tenantId: string, dto: CreateCustomerDto) {
    // Check for duplicate document within tenant
    if (dto.document) {
      const existing = await this.prisma.customer.findFirst({
        where: { tenantId, document: dto.document, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(
          `Já existe um cliente com o documento "${dto.document}"`,
        );
      }
    }

    // Check for duplicate email within tenant
    if (dto.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: { tenantId, email: dto.email, deletedAt: null },
      });
      if (existingEmail) {
        throw new ConflictException(
          `Já existe um cliente com o e-mail "${dto.email}"`,
        );
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        document: dto.document,
        documentType: dto.documentType,
        tradeName: dto.tradeName,
        segment: dto.segment,
        tags: dto.tags ?? [],
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
      include: {
        addresses: true,
      },
    });

    this.logger.log(
      `Customer created: ${customer.id} (${customer.name}) for tenant ${tenantId}`,
    );
    return customer;
  }

  /**
   * Update a customer.
   */
  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(
        `Cliente com id ${id} não encontrado`,
      );
    }

    // Check for duplicate document if changed
    if (dto.document && dto.document !== existing.document) {
      const docExists = await this.prisma.customer.findFirst({
        where: {
          tenantId,
          document: dto.document,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (docExists) {
        throw new ConflictException(
          `Já existe um cliente com o documento "${dto.document}"`,
        );
      }
    }

    // Check for duplicate email if changed
    if (dto.email && dto.email !== existing.email) {
      const emailExists = await this.prisma.customer.findFirst({
        where: {
          tenantId,
          email: dto.email,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (emailExists) {
        throw new ConflictException(
          `Já existe um cliente com o e-mail "${dto.email}"`,
        );
      }
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        document: dto.document,
        documentType: dto.documentType,
        tradeName: dto.tradeName,
        segment: dto.segment,
        tags: dto.tags,
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
      include: {
        addresses: true,
      },
    });

    this.logger.log(
      `Customer updated: ${customer.id} for tenant ${tenantId}`,
    );
    return customer;
  }

  /**
   * Soft delete a customer.
   */
  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(
        `Cliente com id ${id} não encontrado`,
      );
    }

    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(
      `Customer soft-deleted: ${id} for tenant ${tenantId}`,
    );
    return { success: true, message: 'Cliente removido com sucesso' };
  }
}

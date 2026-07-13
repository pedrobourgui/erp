import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateCashRegisterDto,
  UpdateCashRegisterDto,
  OpenSessionDto,
  CloseSessionDto,
  CashMovementDto,
  CashRegisterQueryDto,
  SessionQueryDto,
} from './dto/cash-register.dto';
import {
  PaginatedResponse,
  buildPaginatedResponse,
  buildPrismaOrderBy,
} from '../../common/utils/pagination';

@Injectable()
export class CashRegistersService {
  private readonly logger = new Logger(CashRegistersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Cash Registers CRUD ─────────────────────────────────────────────

  async findAll(
    tenantId: string,
    query: CashRegisterQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CashRegisterWhereInput = { tenantId };

    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.cashRegister.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          financialAccount: { select: { id: true, name: true, type: true } },
          sessions: {
            where: { status: 'OPEN' },
            take: 1,
            select: { id: true, status: true, operatorId: true, openedAt: true, openingBalance: true },
          },
        },
      }),
      this.prisma.cashRegister.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortOrder: 'desc' });
  }

  async create(tenantId: string, dto: CreateCashRegisterDto) {
    // Validate financial account exists and belongs to tenant
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: dto.financialAccountId, tenantId },
    });

    if (!account) {
      throw new NotFoundException(
        `Financial account ${dto.financialAccountId} not found for tenant ${tenantId}`,
      );
    }

    // Check for duplicate name
    const existing = await this.prisma.cashRegister.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictException(
        `Cash register with name "${dto.name}" already exists for this tenant`,
      );
    }

    const cashRegister = await this.prisma.cashRegister.create({
      data: {
        tenantId,
        name: dto.name,
        financialAccountId: dto.financialAccountId,
        isActive: dto.isActive ?? true,
      },
      include: {
        financialAccount: { select: { id: true, name: true, type: true } },
      },
    });

    this.logger.log(
      `Cash register created: ${cashRegister.name} (${cashRegister.id}) for tenant ${tenantId}`,
    );

    return cashRegister;
  }

  async update(tenantId: string, id: string, dto: UpdateCashRegisterDto) {
    const existing = await this.prisma.cashRegister.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Cash register with id ${id} not found for tenant ${tenantId}`,
      );
    }

    if (dto.financialAccountId) {
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: dto.financialAccountId, tenantId },
      });
      if (!account) {
        throw new NotFoundException(
          `Financial account ${dto.financialAccountId} not found for tenant ${tenantId}`,
        );
      }
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.cashRegister.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (duplicate) {
        throw new ConflictException(
          `Cash register with name "${dto.name}" already exists for this tenant`,
        );
      }
    }

    const updated = await this.prisma.cashRegister.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.financialAccountId !== undefined && { financialAccountId: dto.financialAccountId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        financialAccount: { select: { id: true, name: true, type: true } },
      },
    });

    this.logger.log(
      `Cash register updated: ${updated.name} (${updated.id}) for tenant ${tenantId}`,
    );

    return updated;
  }

  // ─── Session Operations ──────────────────────────────────────────────

  async openSession(
    tenantId: string,
    cashRegisterId: string,
    userId: string,
    dto: OpenSessionDto,
  ) {
    const cashRegister = await this.prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, tenantId },
    });

    if (!cashRegister) {
      throw new NotFoundException(
        `Cash register with id ${cashRegisterId} not found for tenant ${tenantId}`,
      );
    }

    if (!cashRegister.isActive) {
      throw new BadRequestException('Cannot open session for an inactive cash register');
    }

    // Check if there is already an open session
    const openSession = await this.prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId, tenantId, status: 'OPEN' },
    });

    if (openSession) {
      throw new BadRequestException(
        `Cash register "${cashRegister.name}" already has an open session`,
      );
    }

    const session = await this.prisma.cashRegisterSession.create({
      data: {
        tenantId,
        cashRegisterId,
        operatorId: userId,
        status: 'OPEN',
        openingBalance: dto.openingBalance,
      },
      include: {
        cashRegister: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
      },
    });

    this.logger.log(
      `Cash session opened: ${session.id} for register ${cashRegister.name} by user ${userId}`,
    );

    return session;
  }

  async closeSession(
    tenantId: string,
    cashRegisterId: string,
    userId: string,
    dto: CloseSessionDto,
  ) {
    const cashRegister = await this.prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, tenantId },
    });

    if (!cashRegister) {
      throw new NotFoundException(
        `Cash register with id ${cashRegisterId} not found for tenant ${tenantId}`,
      );
    }

    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId, tenantId, status: 'OPEN' },
      include: {
        movements: true,
      },
    });

    if (!session) {
      throw new BadRequestException(
        `No open session found for cash register "${cashRegister.name}"`,
      );
    }

    // Calculate expected balance
    const supplies = session.movements
      .filter((m) => m.type === 'SUPPLY')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const withdrawals = session.movements
      .filter((m) => m.type === 'WITHDRAW')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    // Sum sales paid in cash during this session — only CASH payments enter the
    // physical drawer (assumption: one open session per tenant, so counter sales
    // are stamped with this session id at creation).
    const cashSalesAgg = await this.prisma.orderPayment.aggregate({
      _sum: { amount: true },
      where: {
        tenantId,
        paymentMethod: { type: 'CASH' },
        order: { cashRegisterSessionId: session.id },
      },
    });
    const cashSales = Number(cashSalesAgg._sum.amount ?? 0);

    const expectedBalance =
      Number(session.openingBalance) + supplies - withdrawals + cashSales;

    const difference = dto.closingBalance - expectedBalance;

    const closed = await this.prisma.cashRegisterSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        closedById: userId,
        closedAt: new Date(),
        closingBalance: dto.closingBalance,
        expectedBalance,
        difference,
        notes: dto.notes,
      },
      include: {
        cashRegister: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        movements: true,
      },
    });

    this.logger.log(
      `Cash session closed: ${session.id} for register ${cashRegister.name}. ` +
        `Expected: ${expectedBalance}, Counted: ${dto.closingBalance}, Diff: ${difference}`,
    );

    return closed;
  }

  async supply(
    tenantId: string,
    cashRegisterId: string,
    userId: string,
    dto: CashMovementDto,
  ) {
    const session = await this.getOpenSession(tenantId, cashRegisterId);

    const movement = await this.prisma.cashRegisterMovement.create({
      data: {
        tenantId,
        sessionId: session.id,
        type: 'SUPPLY',
        amount: dto.amount,
        reason: dto.reason,
        performedById: userId,
      },
      include: {
        performedBy: { select: { id: true, name: true } },
      },
    });

    this.logger.log(
      `Cash supply: ${dto.amount} to session ${session.id} by user ${userId}. Reason: ${dto.reason}`,
    );

    return movement;
  }

  async withdraw(
    tenantId: string,
    cashRegisterId: string,
    userId: string,
    dto: CashMovementDto,
  ) {
    const session = await this.getOpenSession(tenantId, cashRegisterId);

    const movement = await this.prisma.cashRegisterMovement.create({
      data: {
        tenantId,
        sessionId: session.id,
        type: 'WITHDRAW',
        amount: dto.amount,
        reason: dto.reason,
        performedById: userId,
      },
      include: {
        performedBy: { select: { id: true, name: true } },
      },
    });

    this.logger.log(
      `Cash withdrawal: ${dto.amount} from session ${session.id} by user ${userId}. Reason: ${dto.reason}`,
    );

    return movement;
  }

  async getCurrentSession(tenantId: string, cashRegisterId: string) {
    const cashRegister = await this.prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, tenantId },
    });

    if (!cashRegister) {
      throw new NotFoundException(
        `Cash register with id ${cashRegisterId} not found for tenant ${tenantId}`,
      );
    }

    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId, tenantId, status: 'OPEN' },
      include: {
        cashRegister: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        movements: {
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!session) {
      return { success: true, data: null, message: 'No open session' };
    }

    // Calculate running totals
    const supplies = session.movements
      .filter((m) => m.type === 'SUPPLY')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const withdrawals = session.movements
      .filter((m) => m.type === 'WITHDRAW')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const currentBalance =
      Number(session.openingBalance) + supplies - withdrawals;

    return {
      ...session,
      totals: {
        supplies,
        withdrawals,
        currentBalance,
      },
    };
  }

  // ─── Session History ─────────────────────────────────────────────────

  async findAllSessions(
    tenantId: string,
    query: SessionQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const {
      page = 1,
      limit = 20,
      cashRegisterId,
      status,
      sortBy,
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.CashRegisterSessionWhereInput = { tenantId };

    if (cashRegisterId) where.cashRegisterId = cashRegisterId;
    if (status) where.status = status as Prisma.EnumCashSessionStatusFilter;

    const [data, total] = await Promise.all([
      this.prisma.cashRegisterSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildPrismaOrderBy(sortBy || 'openedAt', sortOrder),
        include: {
          cashRegister: { select: { id: true, name: true } },
          operator: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.cashRegisterSession.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, { page, limit, sortBy, sortOrder });
  }

  async findOneSession(tenantId: string, sessionId: string) {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        cashRegister: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        movements: {
          orderBy: { createdAt: 'asc' },
          include: {
            performedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(
        `Session with id ${sessionId} not found for tenant ${tenantId}`,
      );
    }

    // Calculate totals
    const supplies = session.movements
      .filter((m) => m.type === 'SUPPLY')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const withdrawals = session.movements
      .filter((m) => m.type === 'WITHDRAW')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    return {
      ...session,
      totals: {
        supplies,
        withdrawals,
      },
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private async getOpenSession(tenantId: string, cashRegisterId: string) {
    const cashRegister = await this.prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, tenantId },
    });

    if (!cashRegister) {
      throw new NotFoundException(
        `Cash register with id ${cashRegisterId} not found for tenant ${tenantId}`,
      );
    }

    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId, tenantId, status: 'OPEN' },
    });

    if (!session) {
      throw new BadRequestException(
        `No open session found for cash register "${cashRegister.name}". Open a session first.`,
      );
    }

    return session;
  }
}

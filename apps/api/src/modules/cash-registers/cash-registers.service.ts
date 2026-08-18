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
import {
  formatBRL,
  subtractMoney,
  sumMoney,
  toMoney,
} from '../../common/utils/money.util';


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
        `Conta financeira não encontrada`,
      );
    }

    // Check for duplicate name
    const existing = await this.prisma.cashRegister.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe um caixa chamado "${dto.name}"`,
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
        `Caixa não encontrado`,
      );
    }

    if (dto.financialAccountId) {
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: dto.financialAccountId, tenantId },
      });
      if (!account) {
        throw new NotFoundException(
          `Conta financeira não encontrada`,
        );
      }
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.cashRegister.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (duplicate) {
        throw new ConflictException(
          `Já existe um caixa chamado "${dto.name}"`,
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
        `Caixa não encontrado`,
      );
    }

    if (!cashRegister.isActive) {
      throw new BadRequestException('Não é possível abrir um caixa inativo');
    }

    // Check if there is already an open session
    const openSession = await this.prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId, tenantId, status: 'OPEN' },
    });

    if (openSession) {
      throw new BadRequestException(
        `O caixa "${cashRegister.name}" já está aberto`,
      );
    }

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashRegisterSession.create({
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

      // FN-15: the opening float is money entering the drawer.
      await this.bookOnAccount(tx, {
        tenantId,
        accountId: cashRegister.financialAccountId,
        direction: 'in',
        amount: toMoney(dto.openingBalance),
        description: `Abertura de caixa - ${cashRegister.name}`,
        sessionId: created.id,
      });

      return created;
    });

    this.logger.log(
      `Cash session opened: ${session.id} for register ${cashRegister.name} by user ${userId}`,
    );

    return session;
  }


  // ─── FN-06 / FN-15: saldo do caixa e reflexo na conta ────────────────────

  /**
   * Money physically in the drawer right now.
   *
   * FN-06: nothing checked this before a sangria, so the register reached
   * −R$ 4.999.300,00 and the closing screen reported the resulting "difference"
   * in green, as if the drawer had a surplus.
   */
  private async availableBalance(
    tenantId: string,
    session: {
      id: string;
      openingBalance: Prisma.Decimal | number;
      movements: { type: string; amount: Prisma.Decimal | number }[];
    },
  ): Promise<number> {
    // Only CASH payments reach the physical drawer.
    const cashSales = await this.prisma.orderPayment.aggregate({
      _sum: { amount: true },
      where: {
        tenantId,
        paymentMethod: { type: 'CASH' },
        order: { cashRegisterSessionId: session.id },
      },
    });

    const supplies = sumMoney(
      session.movements.filter((m) => m.type === 'SUPPLY').map((m) => m.amount),
    );
    const withdrawals = sumMoney(
      session.movements.filter((m) => m.type === 'WITHDRAW').map((m) => m.amount),
    );

    return sumMoney([
      session.openingBalance,
      supplies,
      cashSales._sum.amount,
      -withdrawals,
    ]);
  }

  /**
   * FN-15: mirrors a drawer movement on the linked FinancialAccount.
   *
   * The account of a cash register *is* the drawer: money entering the drawer
   * credits it, money leaving debits it. Without this the linked account stayed
   * at R$ 0,00 through a whole day of supplies and sangrias and there was
   * nothing to reconcile against.
   *
   * A register with no linked account simply books nothing — the movement is
   * still recorded, it just has no accounting counterpart.
   */
  private async bookOnAccount(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      accountId: string | null;
      direction: 'in' | 'out';
      amount: number;
      description: string;
      sessionId: string;
    },
  ): Promise<void> {
    if (!input.accountId || input.amount <= 0) return;

    const account = await tx.financialAccount.update({
      where: { id: input.accountId },
      data: {
        balance:
          input.direction === 'in'
            ? { increment: input.amount }
            : { decrement: input.amount },
      },
      select: { balance: true },
    });

    await tx.financialTransaction.create({
      data: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        type: input.direction === 'in' ? 'CREDIT' : 'DEBIT',
        amount: input.amount,
        balanceAfter: account.balance,
        description: input.description,
        referenceType: 'cash-register',
        referenceId: input.sessionId,
      },
    });
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
        `Caixa não encontrado`,
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
        `O caixa "${cashRegister.name}" não está aberto`,
      );
    }

    // What the drawer should hold: opening float + supplies − sangrias + cash
    // sales stamped with this session (SCRUM-29). Same computation the sangria
    // validates against, so the two can never disagree (FN-06).
    const expectedBalance = await this.availableBalance(tenantId, session);
    const closingBalance = toMoney(dto.closingBalance);
    const difference = subtractMoney(closingBalance, expectedBalance);

    const closed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cashRegisterSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          closedById: userId,
          closedAt: new Date(),
          closingBalance,
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

      // FN-15: the counted difference is real money the account does not know
      // about yet — a shortfall leaves the account, a surplus enters it.
      if (difference !== 0) {
        await this.bookOnAccount(tx, {
          tenantId,
          accountId: cashRegister.financialAccountId,
          direction: difference > 0 ? 'in' : 'out',
          amount: Math.abs(difference),
          description: `${difference > 0 ? 'Sobra' : 'Falta'} no fechamento - ${cashRegister.name}`,
          sessionId: session.id,
        });
      }

      return updated;
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
    const register = await this.loadRegister(tenantId, cashRegisterId);
    const session = await this.getOpenSession(tenantId, cashRegisterId);
    const amount = toMoney(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('O valor do suprimento deve ser maior que zero');
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashRegisterMovement.create({
        data: {
          tenantId,
          sessionId: session.id,
          type: 'SUPPLY',
          amount,
          reason: dto.reason,
          performedById: userId,
        },
        include: {
          performedBy: { select: { id: true, name: true } },
        },
      });

      await this.bookOnAccount(tx, {
        tenantId,
        accountId: register.financialAccountId,
        direction: 'in',
        amount,
        description: `Suprimento de caixa - ${dto.reason}`,
        sessionId: session.id,
      });

      return created;
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
    const register = await this.loadRegister(tenantId, cashRegisterId);
    const session = await this.getOpenSession(tenantId, cashRegisterId);
    const amount = toMoney(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('O valor da sangria deve ser maior que zero');
    }

    // FN-06: a drawer cannot hold negative cash.
    const available = await this.availableBalance(tenantId, session);
    if (amount > available) {
      throw new BadRequestException(
        `Saldo insuficiente no caixa (disponível: ${formatBRL(available)})`,
      );
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashRegisterMovement.create({
        data: {
          tenantId,
          sessionId: session.id,
          type: 'WITHDRAW',
          amount,
          reason: dto.reason,
          performedById: userId,
        },
        include: {
          performedBy: { select: { id: true, name: true } },
        },
      });

      await this.bookOnAccount(tx, {
        tenantId,
        accountId: register.financialAccountId,
        direction: 'out',
        amount,
        description: `Sangria de caixa - ${dto.reason}`,
        sessionId: session.id,
      });

      return created;
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
        `Caixa não encontrado`,
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

    // A tela e o fechamento contam a mesma coisa: as vendas em dinheiro da
    // sessão entram no saldo. Sem elas a tela mostrava R$ 100 enquanto o
    // fechamento esperava R$ 249,90, e o operador conferia contra o número
    // errado — a "diferença" nascia da tela, não da gaveta.
    const supplies = sumMoney(
      session.movements.filter((m) => m.type === 'SUPPLY').map((m) => m.amount),
    );
    const withdrawals = sumMoney(
      session.movements.filter((m) => m.type === 'WITHDRAW').map((m) => m.amount),
    );
    const cashSalesAgg = await this.prisma.orderPayment.aggregate({
      _sum: { amount: true },
      where: {
        tenantId,
        paymentMethod: { type: 'CASH' },
        order: { cashRegisterSessionId: session.id },
      },
    });
    const cashSales = toMoney(cashSalesAgg._sum.amount);
    const currentBalance = await this.availableBalance(tenantId, session);

    return {
      ...session,
      totals: {
        supplies,
        withdrawals,
        cashSales,
        currentBalance,
      },
    };
  }

  // ─── Session History ─────────────────────────────────────────────────

  /**
   * VD-07: the point of sale needs the open session, so `seller` can reach this
   * listing with `cash-registers:read-session`. That permission must not hand it
   * the whole cash history — other operators' closing balances and differences —
   * so a caller without `financial:read` only ever sees open sessions.
   */
  async findAllSessions(
    tenantId: string,
    query: SessionQueryDto,
    scope: { openSessionsOnly?: boolean } = {},
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
    if (scope.openSessionsOnly) where.status = 'OPEN';

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
        `Sessão de caixa não encontrada`,
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

  private async loadRegister(tenantId: string, cashRegisterId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, tenantId },
    });
    if (!register) {
      throw new NotFoundException(
        `Caixa não encontrado`,
      );
    }
    return register;
  }

  private async getOpenSession(tenantId: string, cashRegisterId: string) {
    const cashRegister = await this.prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, tenantId },
    });

    if (!cashRegister) {
      throw new NotFoundException(
        `Caixa não encontrado`,
      );
    }

    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { cashRegisterId, tenantId, status: 'OPEN' },
      // FN-06: os movimentos vêm junto porque toda operação precisa saber o
      // saldo disponível antes de mexer no caixa.
      include: { movements: { select: { type: true, amount: true } } },
    });

    if (!session) {
      throw new BadRequestException(
        `O caixa "${cashRegister.name}" não está aberto. Abra o caixa para continuar.`,
      );
    }

    return session;
  }
}

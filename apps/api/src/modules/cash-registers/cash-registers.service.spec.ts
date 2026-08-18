import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CashRegistersService } from './cash-registers.service';
import { PrismaService } from '../../database/prisma/prisma.service';

// ─── Constants ────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const REGISTER_ID = 'reg-uuid-001';
const SESSION_ID = 'session-uuid-001';

function createMockPrisma() {
  const tx = {
    cashRegisterMovement: { create: jest.fn().mockResolvedValue({ id: 'mov-1' }) },
    financialAccount: { update: jest.fn().mockResolvedValue({ balance: 1000 }) },
    financialTransaction: { create: jest.fn().mockResolvedValue({ id: 'trx-1' }) },
    cashRegisterSession: { create: jest.fn(), update: jest.fn() },
  };
  return {
    tx,
    cashRegister: {
      findFirst: jest.fn(),
    },
    cashRegisterSession: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cashRegisterMovement: {
      create: jest.fn(),
    },
    orderPayment: {
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
}

describe('CashRegistersService', () => {
  let service: CashRegistersService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashRegistersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CashRegistersService>(CashRegistersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── FN-06: sangria não pode passar do saldo do caixa ────────────────────

  describe('withdraw (FN-06)', () => {
    // The QA drained a register to −R$ 4.999.300,00 and the closing screen
    // reported a "difference" of R$ 5.000.300,00 painted green, as if the
    // drawer had a surplus. A drawer cannot hold negative cash.
    beforeEach(() => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: REGISTER_ID,
        name: 'Caixa 01',
        financialAccountId: 'acc-1',
        isActive: true,
      });
      prisma.cashRegisterSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 100,
        movements: [
          { type: 'SUPPLY', amount: 50 },
          { type: 'WITHDRAW', amount: 20 },
        ],
      });
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 30 } });
    });

    it('allows a withdrawal up to the available balance', async () => {
      // 100 opening + 50 supply - 20 withdrawn + 30 cash sales = 160
      await expect(
        service.withdraw(TENANT_ID, REGISTER_ID, USER_ID, {
          amount: 160,
          reason: 'Sangria para o cofre',
        }),
      ).resolves.toBeDefined();
    });

    it('refuses a withdrawal larger than the available balance', async () => {
      await expect(
        service.withdraw(TENANT_ID, REGISTER_ID, USER_ID, {
          amount: 160.01,
          reason: 'Sangria absurda',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('says how much is actually available', async () => {
      await expect(
        service.withdraw(TENANT_ID, REGISTER_ID, USER_ID, {
          amount: 5000,
          reason: 'Sangria absurda',
        }),
      ).rejects.toThrow(/160/);
    });

    it('counts cash sales of the session as available money', async () => {
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });

      await expect(
        service.withdraw(TENANT_ID, REGISTER_ID, USER_ID, {
          amount: 1000,
          reason: 'Sangria do dia',
        }),
      ).resolves.toBeDefined();
    });

    it('refuses a zero or negative withdrawal', async () => {
      await expect(
        service.withdraw(TENANT_ID, REGISTER_ID, USER_ID, { amount: 0, reason: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── FN-15: o caixa físico tem que refletir na conta financeira ──────────

  describe('cash movements reach the linked account (FN-15)', () => {
    // openSession/supply/withdraw/closeSession never touched FinancialAccount,
    // so the linked account stayed at R$ 0,00 through a whole day of sales,
    // supplies and sangrias — there was nothing to reconcile against.
    beforeEach(() => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: REGISTER_ID,
        name: 'Caixa 01',
        financialAccountId: 'acc-1',
        isActive: true,
      });
      prisma.cashRegisterSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 100,
        movements: [],
      });
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.tx.cashRegisterSession.create.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 100,
      });
    });

    it('credits the account when the drawer receives a supply', async () => {
      await service.supply(TENANT_ID, REGISTER_ID, USER_ID, {
        amount: 200,
        reason: 'Troco',
      });

      expect(prisma.tx.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 200 } },
        select: { balance: true },
      });
      const trx = prisma.tx.financialTransaction.create.mock.calls[0][0].data;
      expect(trx).toMatchObject({
        type: 'CREDIT',
        amount: 200,
        referenceType: 'cash-register',
      });
    });

    it('debits the account when money leaves the drawer', async () => {
      prisma.cashRegisterSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 500,
        movements: [],
      });

      await service.withdraw(TENANT_ID, REGISTER_ID, USER_ID, {
        amount: 200,
        reason: 'Sangria',
      });

      expect(prisma.tx.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 200 } },
        select: { balance: true },
      });
      const trx = prisma.tx.financialTransaction.create.mock.calls[0][0].data;
      expect(trx).toMatchObject({ type: 'DEBIT', amount: 200 });
    });

    it('books the opening float when the session opens', async () => {
      prisma.cashRegisterSession.findFirst.mockResolvedValue(null);

      await service.openSession(TENANT_ID, REGISTER_ID, USER_ID, {
        openingBalance: 100,
      });

      expect(prisma.tx.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 100 } },
        select: { balance: true },
      });
    });

    it('does not book anything when the session opens empty', async () => {
      prisma.cashRegisterSession.findFirst.mockResolvedValue(null);
      prisma.tx.cashRegisterSession.create.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 0,
      });

      await service.openSession(TENANT_ID, REGISTER_ID, USER_ID, {
        openingBalance: 0,
      });

      expect(prisma.tx.financialAccount.update).not.toHaveBeenCalled();
    });

    it('books the counted difference when the session closes short', async () => {
      prisma.cashRegisterSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 100,
        movements: [],
      });
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.tx.cashRegisterSession.update.mockResolvedValue({ id: SESSION_ID });

      // Expected 100, counted 90 — R$ 10 short. The account has to know.
      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: 90,
      });

      expect(prisma.tx.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 10 } },
        select: { balance: true },
      });
    });

    it('books nothing on a session that closes exactly', async () => {
      prisma.tx.cashRegisterSession.update.mockResolvedValue({ id: SESSION_ID });

      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: 100,
      });

      expect(prisma.tx.financialAccount.update).not.toHaveBeenCalled();
    });

    it('does not fail when the register has no linked account', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: REGISTER_ID,
        name: 'Caixa sem conta',
        financialAccountId: null,
        isActive: true,
      });

      await expect(
        service.supply(TENANT_ID, REGISTER_ID, USER_ID, { amount: 50, reason: 'x' }),
      ).resolves.toBeDefined();
      expect(prisma.tx.financialAccount.update).not.toHaveBeenCalled();
    });
  });

  // ─── A tela do caixa e o fechamento têm que contar a mesma coisa ─────────

  describe('getCurrentSession totals', () => {
    // A conciliação de um dia inteiro pegou isto: a tela mostrava "saldo atual
    // R$ 100" e o fechamento esperava R$ 249,90 — a tela não somava as vendas
    // em dinheiro da sessão. O operador conferia a gaveta contra o número
    // errado e o caixa "fechava" com diferença.
    beforeEach(() => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: REGISTER_ID,
        name: 'Caixa 01',
        financialAccountId: 'acc-1',
      });
      prisma.cashRegisterSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 200,
        movements: [
          { type: 'SUPPLY', amount: 50 },
          { type: 'WITHDRAW', amount: 100 },
        ],
      });
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 149.9 } });
    });

    /** A sessão aberta sempre tem totais; o `null` é o caso "sem sessão". */
    async function openTotals() {
      const result = await service.getCurrentSession(TENANT_ID, REGISTER_ID);
      if (!('totals' in result)) throw new Error('expected an open session');
      return result.totals;
    }

    it('includes the cash sales of the session in the running balance', async () => {
      const totals = await openTotals();

      // 200 + 50 - 100 + 149.90
      expect(totals.currentBalance).toBe(299.9);
    });

    it('reports the cash sales as their own figure', async () => {
      const totals = await openTotals();

      expect(totals.cashSales).toBe(149.9);
      expect(totals.supplies).toBe(50);
      expect(totals.withdrawals).toBe(100);
    });

    it('agrees with what closeSession will expect', async () => {
      const totals = await openTotals();
      prisma.tx.cashRegisterSession.update.mockResolvedValue({ id: SESSION_ID });

      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: totals.currentBalance,
      });

      const data = prisma.tx.cashRegisterSession.update.mock.calls[0][0].data;
      expect(data.expectedBalance).toBe(totals.currentBalance);
      expect(data.difference).toBe(0);
    });
  });

  // ─── findAllSessions — least privilege for the seller (VD-07) ─────────────

  describe('findAllSessions', () => {
    beforeEach(() => {
      prisma.cashRegisterSession.findMany.mockResolvedValue([]);
      prisma.cashRegisterSession.count.mockResolvedValue(0);
    });

    function whereOfLastQuery() {
      return prisma.cashRegisterSession.findMany.mock.calls[0][0].where;
    }

    it('returns every session for a caller who can read the financial module', async () => {
      await service.findAllSessions(TENANT_ID, {}, { openSessionsOnly: false });

      expect(whereOfLastQuery()).toEqual({ tenantId: TENANT_ID });
    });

    it('returns only open sessions when the caller only has cash-registers:read-session', async () => {
      await service.findAllSessions(TENANT_ID, {}, { openSessionsOnly: true });

      expect(whereOfLastQuery()).toEqual({ tenantId: TENANT_ID, status: 'OPEN' });
    });

    it('ignores a CLOSED filter from a caller restricted to open sessions', async () => {
      await service.findAllSessions(
        TENANT_ID,
        { status: 'CLOSED' },
        { openSessionsOnly: true },
      );

      expect(whereOfLastQuery()).toEqual({ tenantId: TENANT_ID, status: 'OPEN' });
    });

    it('defaults to the unrestricted listing when no scope is given', async () => {
      await service.findAllSessions(TENANT_ID, {});

      expect(whereOfLastQuery()).toEqual({ tenantId: TENANT_ID });
    });

    it('keeps scoping every query by tenant', async () => {
      await service.findAllSessions(TENANT_ID, { cashRegisterId: REGISTER_ID });

      expect(whereOfLastQuery()).toEqual({
        tenantId: TENANT_ID,
        cashRegisterId: REGISTER_ID,
      });
    });
  });

  // ─── closeSession — expectedBalance including cash sales (SCRUM-29) ────────

  describe('closeSession', () => {
    beforeEach(() => {
      prisma.cashRegister.findFirst.mockResolvedValue({ id: REGISTER_ID, name: 'Caixa 01' });
      prisma.cashRegisterSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 100,
        movements: [
          { type: 'SUPPLY', amount: 50 },
          { type: 'WITHDRAW', amount: 20 },
        ],
      });
      // Echo the update data so we can assert on expectedBalance/difference
      prisma.cashRegisterSession.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({ id: SESSION_ID, ...data }),
      );
    });

    it('should add cash sales of the session to the expected balance', async () => {
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 200 } });

      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: 335,
      } as never);

      const data = prisma.tx.cashRegisterSession.update.mock.calls[0][0].data;
      // 100 (opening) + 50 (supply) - 20 (withdraw) + 200 (cash sales) = 330
      expect(data.expectedBalance).toBe(330);
      // Counted 335 => positive difference (surplus) of 5
      expect(data.difference).toBe(5);
    });

    it('should sum only CASH payments of orders linked to this session, scoped by tenant', async () => {
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: 130,
      } as never);

      const where = prisma.orderPayment.aggregate.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT_ID);
      expect(where.paymentMethod).toEqual({ type: 'CASH' });
      expect(where.order).toEqual({ cashRegisterSessionId: SESSION_ID });
    });

    it('should fall back to opening + supplies - withdrawals when there are no cash sales', async () => {
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: 130,
      } as never);

      const data = prisma.tx.cashRegisterSession.update.mock.calls[0][0].data;
      // 100 + 50 - 20 + 0 = 130 => difference 0
      expect(data.expectedBalance).toBe(130);
      expect(data.difference).toBe(0);
    });

    it('should throw when there is no open session for the register', async () => {
      prisma.cashRegisterSession.findFirst.mockResolvedValue(null);

      await expect(
        service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, { closingBalance: 100 } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

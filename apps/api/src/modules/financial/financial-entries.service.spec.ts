import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FinancialEntriesService } from './financial-entries.service';
import { PrismaService } from '../../database/prisma/prisma.service';

const TENANT_A = 'tenant-aaa-111';
const TENANT_B = 'tenant-bbb-222';

function createMockTx() {
  return {
    financialAccount: { update: jest.fn() },
    financialTransaction: { create: jest.fn() },
  };
}

function createMockPrisma(mockTx: ReturnType<typeof createMockTx>) {
  return {
    financialAccount: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    chartOfAccounts: { findFirst: jest.fn() },
    financialTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    accountsReceivable: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null, paidAmount: null } }),
    },
    accountsPayable: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null, paidAmount: null } }),
    },
    $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  };
}

describe('FinancialEntriesService', () => {
  let service: FinancialEntriesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockTx: ReturnType<typeof createMockTx>;

  beforeEach(async () => {
    mockTx = createMockTx();
    prisma = createMockPrisma(mockTx);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialEntriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FinancialEntriesService>(FinancialEntriesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ───────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      prisma.financialAccount.findFirst.mockResolvedValue({ id: 'acc-1' });
    });

    it('should credit the account balance and create a CREDIT transaction for a paid revenue', async () => {
      mockTx.financialAccount.update.mockResolvedValue({ balance: 1500 });
      mockTx.financialTransaction.create.mockResolvedValue({
        id: 'trx-1',
        type: 'CREDIT',
        amount: 1500,
      });

      const result = await service.create(TENANT_A, {
        type: 'REVENUE',
        accountId: 'acc-1',
        amount: 1500,
        date: '2026-07-08',
        paid: true,
      });

      expect(mockTx.financialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-1' },
          data: { balance: { increment: 1500 } },
        }),
      );
      expect(mockTx.financialTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A,
            type: 'CREDIT',
            balanceAfter: 1500,
            referenceType: 'manual',
          }),
        }),
      );
      expect(result).toMatchObject({ kind: 'TRANSACTION', type: 'REVENUE', status: 'PAID' });
      expect(prisma.accountsReceivable.create).not.toHaveBeenCalled();
    });

    it('should debit the account balance and create a DEBIT transaction for a paid expense', async () => {
      mockTx.financialAccount.update.mockResolvedValue({ balance: -200 });
      mockTx.financialTransaction.create.mockResolvedValue({
        id: 'trx-2',
        type: 'DEBIT',
        amount: 200,
      });

      const result = await service.create(TENANT_A, {
        type: 'EXPENSE',
        accountId: 'acc-1',
        amount: 200,
        date: '2026-07-08',
        paid: true,
      });

      expect(mockTx.financialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { balance: { decrement: 200 } } }),
      );
      expect(result).toMatchObject({ kind: 'TRANSACTION', type: 'EXPENSE' });
    });

    it('should create a PENDING receivable for a term revenue without touching balance', async () => {
      prisma.accountsReceivable.create.mockResolvedValue({
        id: 'rec-1',
        status: 'PENDING',
        amount: 900,
      });

      const result = await service.create(TENANT_A, {
        type: 'REVENUE',
        accountId: 'acc-1',
        amount: 900,
        date: '2026-07-08',
        paid: false,
        dueDate: '2026-08-08',
      });

      expect(prisma.accountsReceivable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A,
            status: 'PENDING',
            metadata: { manual: true, financialAccountId: 'acc-1' },
          }),
        }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result).toMatchObject({ kind: 'RECEIVABLE', type: 'REVENUE' });
    });

    it('should create a PENDING payable for a term expense', async () => {
      prisma.accountsPayable.create.mockResolvedValue({
        id: 'pay-1',
        status: 'PENDING',
        amount: 500,
      });

      const result = await service.create(TENANT_A, {
        type: 'EXPENSE',
        accountId: 'acc-1',
        amount: 500,
        date: '2026-07-08',
        paid: false,
        dueDate: '2026-08-08',
      });

      expect(prisma.accountsPayable.create).toHaveBeenCalled();
      expect(result).toMatchObject({ kind: 'PAYABLE', type: 'EXPENSE' });
    });

    it('should throw BadRequestException for a term entry without dueDate', async () => {
      await expect(
        service.create(TENANT_A, {
          type: 'EXPENSE',
          accountId: 'acc-1',
          amount: 500,
          date: '2026-07-08',
          paid: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw NotFoundException when the account does not belong to the tenant', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_A, {
          type: 'REVENUE',
          accountId: 'acc-x',
          amount: 100,
          date: '2026-07-08',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.financialAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'acc-x', tenantId: TENANT_A } }),
      );
    });

    it('should throw NotFoundException when the chart account does not belong to the tenant', async () => {
      prisma.chartOfAccounts.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_A, {
          type: 'REVENUE',
          accountId: 'acc-1',
          chartAccountId: 'chart-x',
          amount: 100,
          date: '2026-07-08',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should scope every source query by tenantId and return merged data with totals', async () => {
      prisma.financialTransaction.findMany.mockResolvedValue([
        {
          id: 'trx-1',
          type: 'CREDIT',
          amount: 100,
          description: 'Receita manual',
          createdAt: new Date('2026-07-05'),
          accountId: 'acc-1',
          chartAccountId: null,
          chartAccount: null,
        },
      ]);
      prisma.financialTransaction.count.mockResolvedValue(1);
      prisma.financialTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } }) // CREDIT
        .mockResolvedValueOnce({ _sum: { amount: null } }); // DEBIT

      const result = await service.findAll(TENANT_A, { page: 1, limit: 20 });

      expect(prisma.financialTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_A }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ kind: 'TRANSACTION', type: 'REVENUE' });
      expect(result.meta.total).toBe(1);
      expect(result.totals.revenue).toBe(100);
      expect(result.totals.balance).toBe(100);
    });

    // ─── SCRUM-41: sales must show up as receitas ─────────────────────────
    describe('sales (SCRUM-41)', () => {
      it('should NOT restrict transactions to manual entries', async () => {
        await service.findAll(TENANT_A, {});

        const where = prisma.financialTransaction.findMany.mock.calls[0][0].where;
        // A sale books a transaction with referenceType 'order'; filtering by
        // 'manual' is what used to hide it from the list.
        expect(where.referenceType).toBeUndefined();
      });

      it('should list the transaction of a counter sale as a receita', async () => {
        prisma.financialTransaction.findMany.mockResolvedValue([
          {
            id: 'trx-sale',
            type: 'CREDIT',
            amount: 250,
            description: 'Venda balcão PED-000001 - Dinheiro',
            createdAt: new Date('2026-07-10'),
            accountId: 'acc-1',
            chartAccountId: null,
            chartAccount: null,
          },
        ]);
        prisma.financialTransaction.count.mockResolvedValue(1);

        const result = await service.findAll(TENANT_A, {});

        expect(result.data[0]).toMatchObject({
          kind: 'TRANSACTION',
          type: 'REVENUE',
          amount: 250,
          description: 'Venda balcão PED-000001 - Dinheiro',
        });
      });

      it('should NOT restrict títulos to manual entries', async () => {
        await service.findAll(TENANT_A, {});

        const where = prisma.accountsReceivable.findMany.mock.calls[0][0].where;
        expect(where.metadata).toBeUndefined();
        expect(where.tenantId).toBe(TENANT_A);
      });

      it('should list only open títulos (a settled one is represented by its transaction)', async () => {
        await service.findAll(TENANT_A, {});

        const where = prisma.accountsReceivable.findMany.mock.calls[0][0].where;
        expect(where.status).toEqual({
          in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'],
        });
      });

      it('should skip títulos entirely when filtering by PAID', async () => {
        await service.findAll(TENANT_A, { status: 'PAID' });

        expect(prisma.accountsReceivable.findMany).not.toHaveBeenCalled();
        expect(prisma.accountsPayable.findMany).not.toHaveBeenCalled();
        expect(prisma.financialTransaction.findMany).toHaveBeenCalled();
      });

      it('should report the outstanding balance of a partially paid título', async () => {
        prisma.accountsReceivable.findMany.mockResolvedValue([
          {
            id: 'ar-1',
            amount: 250,
            paidAmount: 100,
            description: 'PED-000002 - Boleto',
            dueDate: new Date('2026-08-01'),
            status: 'PARTIALLY_PAID',
            chartAccountId: null,
            chartAccount: null,
            metadata: null,
            orderPayment: { financialAccountId: 'acc-1' },
            paymentMethod: null,
          },
        ]);
        prisma.accountsReceivable.count.mockResolvedValue(1);

        const result = await service.findAll(TENANT_A, {});

        // 250 owed - 100 already received = 150 still open
        expect(result.data[0]).toMatchObject({ kind: 'RECEIVABLE', amount: 150 });
      });

      it('should total open títulos by their outstanding balance', async () => {
        prisma.accountsReceivable.aggregate.mockResolvedValue({
          _sum: { amount: 250, paidAmount: 100 },
        });

        const result = await service.findAll(TENANT_A, { type: 'REVENUE' });

        expect(result.totals.revenue).toBe(150);
      });

      it('should resolve the account name of a sale título from its order payment', async () => {
        prisma.financialAccount.findMany.mockResolvedValue([
          { id: 'acc-1', name: 'Conta Corrente' },
        ]);
        prisma.accountsReceivable.findMany.mockResolvedValue([
          {
            id: 'ar-1',
            amount: 250,
            paidAmount: 0,
            description: 'PED-000002 - Boleto',
            dueDate: new Date('2026-08-01'),
            status: 'PENDING',
            chartAccountId: null,
            chartAccount: null,
            metadata: null,
            orderPayment: { financialAccountId: 'acc-1' },
            paymentMethod: null,
          },
        ]);
        prisma.accountsReceivable.count.mockResolvedValue(1);

        const result = await service.findAll(TENANT_A, {});

        expect(result.data[0]).toMatchObject({
          accountId: 'acc-1',
          accountName: 'Conta Corrente',
        });
      });
    });

    it('should exclude transactions when filtering by OPEN status', async () => {
      await service.findAll(TENANT_A, { status: 'OPEN' });

      expect(prisma.financialTransaction.findMany).not.toHaveBeenCalled();
      expect(prisma.accountsReceivable.findMany).toHaveBeenCalled();
      expect(prisma.accountsPayable.findMany).toHaveBeenCalled();
    });

    it('should only query receivables when filtering type REVENUE', async () => {
      await service.findAll(TENANT_A, { type: 'REVENUE' });

      expect(prisma.accountsPayable.findMany).not.toHaveBeenCalled();
      expect(prisma.accountsReceivable.findMany).toHaveBeenCalled();
      expect(prisma.financialTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'CREDIT' }),
        }),
      );
    });

    it('should compute the period balance as revenue minus expense', async () => {
      prisma.financialTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 300 } }) // CREDIT
        .mockResolvedValueOnce({ _sum: { amount: 120 } }); // DEBIT

      const result = await service.findAll(TENANT_A, {});

      expect(result.totals.revenue).toBe(300);
      expect(result.totals.expense).toBe(120);
      expect(result.totals.balance).toBe(180);
    });

    it('should scope títulos by tenant', async () => {
      await service.findAll(TENANT_B, {});

      expect(prisma.accountsReceivable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_B }),
        }),
      );
      expect(prisma.accountsPayable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_B }),
        }),
      );
    });
  });
});

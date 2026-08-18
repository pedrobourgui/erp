import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FinancialAccountsService } from './financial-accounts.service';
import { PrismaService } from '../../database/prisma/prisma.service';

const TENANT_A = 'tenant-aaa-111';
const TENANT_B = 'tenant-bbb-222';
const FROM_ID = 'acc-from';
const TO_ID = 'acc-to';

function createMockTx() {
  return {
    financialAccount: {
      update: jest
        .fn()
        .mockResolvedValueOnce({ balance: 800 }) // source after debit
        .mockResolvedValueOnce({ balance: 1200 }), // destination after credit
    },
    financialTransaction: {
      create: jest
        .fn()
        .mockResolvedValueOnce({ id: 'ft-debit' })
        .mockResolvedValueOnce({ id: 'ft-credit' }),
    },
  };
}

function createMockPrisma(tx: ReturnType<typeof createMockTx>) {
  return {
    financialAccount: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'acc-new' }),
      update: jest.fn().mockResolvedValue({ id: 'acc-new' }),
    },
    financialTransaction: { count: jest.fn().mockResolvedValue(0) },
    paymentMethod: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
}

describe('FinancialAccountsService', () => {
  let service: FinancialAccountsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let tx: ReturnType<typeof createMockTx>;

  beforeEach(async () => {
    tx = createMockTx();
    prisma = createMockPrisma(tx);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FinancialAccountsService>(FinancialAccountsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── FN-17: saldo negativo sem aviso ──────────────────────────────────

  describe('transfer — negative balance (FN-17)', () => {
    const dto = { fromAccountId: FROM_ID, toAccountId: TO_ID, amount: 200 };

    function mockSource(type: string, balance: number) {
      prisma.financialAccount.findFirst
        .mockResolvedValueOnce({ id: FROM_ID, name: 'Origem', type, balance })
        .mockResolvedValueOnce({ id: TO_ID, name: 'Destino', type: 'CHECKING' });
    }

    it('refuses to take a cash account below zero', async () => {
      // Dinheiro físico não fica negativo: a gaveta não empresta.
      mockSource('CASH', 50);

      await expect(service.transfer(TENANT_A, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('says how much the cash account actually has', async () => {
      mockSource('CASH', 50);

      await expect(service.transfer(TENANT_A, dto)).rejects.toThrow(/50,00/);
    });

    it('asks for confirmation before taking a bank account negative', async () => {
      mockSource('CHECKING', 50);

      await expect(service.transfer(TENANT_A, dto)).rejects.toThrow(
        /saldo negativo/i,
      );
    });

    it('allows the bank account to go negative once confirmed', async () => {
      mockSource('CHECKING', 50);

      await expect(
        service.transfer(TENANT_A, { ...dto, allowNegativeBalance: true }),
      ).resolves.toBeDefined();
    });

    it('never allows a cash account negative, even confirmed', async () => {
      mockSource('CASH', 50);

      await expect(
        service.transfer(TENANT_A, { ...dto, allowNegativeBalance: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a transfer that leaves the account at exactly zero', async () => {
      mockSource('CASH', 200);

      await expect(service.transfer(TENANT_A, dto)).resolves.toBeDefined();
    });
  });

  describe('transfer', () => {
    const dto = { fromAccountId: FROM_ID, toAccountId: TO_ID, amount: 200 };

    function mockAccountsFound() {
      prisma.financialAccount.findFirst
        .mockResolvedValueOnce({
          id: FROM_ID,
          name: 'Caixa',
          type: 'CASH',
          balance: 1000,
        })
        .mockResolvedValueOnce({ id: TO_ID, name: 'Conta Corrente', type: 'CHECKING' });
    }

    it('should debit the source and credit the destination atomically', async () => {
      mockAccountsFound();

      const result = await service.transfer(TENANT_A, dto);

      expect(tx.financialAccount.update).toHaveBeenNthCalledWith(1, {
        where: { id: FROM_ID },
        data: { balance: { decrement: 200 } },
        select: { balance: true },
      });
      expect(tx.financialAccount.update).toHaveBeenNthCalledWith(2, {
        where: { id: TO_ID },
        data: { balance: { increment: 200 } },
        select: { balance: true },
      });
      expect(result.sourceBalance).toBe(800);
      expect(result.destinationBalance).toBe(1200);
    });

    it('should create two linked transactions (DEBIT + CREDIT) sharing a transferId', async () => {
      mockAccountsFound();

      await service.transfer(TENANT_A, dto);

      const debit = tx.financialTransaction.create.mock.calls[0][0].data;
      const credit = tx.financialTransaction.create.mock.calls[1][0].data;

      expect(debit).toMatchObject({
        tenantId: TENANT_A,
        accountId: FROM_ID,
        type: 'DEBIT',
        amount: 200,
        balanceAfter: 800,
        referenceType: 'transfer',
      });
      expect(credit).toMatchObject({
        tenantId: TENANT_A,
        accountId: TO_ID,
        type: 'CREDIT',
        amount: 200,
        balanceAfter: 1200,
        referenceType: 'transfer',
      });
      // both legs share the same transferId
      expect(debit.referenceId).toBe(credit.referenceId);
      expect((debit.metadata as { transferId: string }).transferId).toBe(
        (credit.metadata as { transferId: string }).transferId,
      );
    });

    it('should reject a transfer to the same account', async () => {
      await expect(
        service.transfer(TENANT_A, { ...dto, toAccountId: FROM_ID }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject a non-positive amount', async () => {
      await expect(
        service.transfer(TENANT_A, { ...dto, amount: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFound when the source account is from another tenant', async () => {
      prisma.financialAccount.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: TO_ID, name: 'Conta Corrente' });

      await expect(service.transfer(TENANT_B, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFound when the destination account does not exist', async () => {
      prisma.financialAccount.findFirst
        .mockResolvedValueOnce({
          id: FROM_ID,
          name: 'Caixa',
          type: 'CASH',
          balance: 1000,
        })
        .mockResolvedValueOnce(null);

      await expect(service.transfer(TENANT_A, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should scope account lookups by tenant', async () => {
      mockAccountsFound();

      await service.transfer(TENANT_A, dto);

      expect(prisma.financialAccount.findFirst).toHaveBeenCalledWith({
        where: { id: FROM_ID, tenantId: TENANT_A },
        // FN-17 precisa do tipo e do saldo para decidir se a conta pode
        // ficar negativa.
        select: { id: true, name: true, type: true, balance: true },
      });
    });
  });
});

// ─── FN-16: duplicidade e ciclo de vida da conta ─────────────────────────

describe('FinancialAccountsService — duplicates and lifecycle (FN-16)', () => {
  let service: FinancialAccountsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma(createMockTx());
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<FinancialAccountsService>(FinancialAccountsService);
  });

  afterEach(() => jest.clearAllMocks());

  const dto = {
    name: 'Banco do Brasil',
    type: 'CHECKING',
    code: 'BB',
  } as never;

  it('refuses a second account with the same code', async () => {
    // "Banco do Brasil | BB" existed twice and every combo became ambiguous —
    // the operator could not tell which one a settlement had credited.
    prisma.financialAccount.findFirst.mockResolvedValueOnce({ id: 'acc-1', code: 'BB' });

    await expect(service.create(TENANT_A, dto)).rejects.toThrow(ConflictException);
  });

  it('refuses a second account with the same name', async () => {
    prisma.financialAccount.findFirst
      .mockResolvedValueOnce(null) // code livre
      .mockResolvedValueOnce({ id: 'acc-1', name: 'Banco do Brasil' });

    await expect(service.create(TENANT_A, dto)).rejects.toThrow(ConflictException);
  });

  it('answers in Portuguese', async () => {
    prisma.financialAccount.findFirst.mockResolvedValueOnce({ id: 'acc-1' });

    await expect(service.create(TENANT_A, dto)).rejects.toThrow(/já existe/i);
  });

  it('creates when neither name nor code collide', async () => {
    prisma.financialAccount.findFirst.mockResolvedValue(null);

    await expect(service.create(TENANT_A, dto)).resolves.toBeDefined();
    expect(prisma.financialAccount.create).toHaveBeenCalled();
  });

  it('checks duplicates only inside the tenant', async () => {
    prisma.financialAccount.findFirst.mockResolvedValue(null);

    await service.create(TENANT_A, dto);

    const where = prisma.financialAccount.findFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT_A);
  });

  describe('remove', () => {
    it('deactivates an account that already has movement instead of deleting it', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        name: 'Santander',
        balance: 0,
      });
      prisma.financialTransaction.count.mockResolvedValue(12);

      const result = await service.remove(TENANT_A, 'acc-1');

      expect(prisma.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { isActive: false },
      });
      expect(result.deactivated).toBe(true);
    });

    it('soft deletes an account that never moved', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        name: 'Nova',
        balance: 0,
      });
      prisma.financialTransaction.count.mockResolvedValue(0);

      const result = await service.remove(TENANT_A, 'acc-1');

      const data = prisma.financialAccount.update.mock.calls[0][0].data;
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(result.deactivated).toBe(false);
    });

    it('404s for an account of another tenant', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_B, 'acc-1')).rejects.toThrow(NotFoundException);
    });

    it('refuses to remove an account with a non-zero balance', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        name: 'Santander',
        balance: 150.5,
      });

      await expect(service.remove(TENANT_A, 'acc-1')).rejects.toThrow(ConflictException);
      expect(prisma.financialAccount.update).not.toHaveBeenCalled();
    });

    it('refuses to remove an account still used as a payment method default', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        name: 'Santander',
        balance: 0,
      });
      prisma.paymentMethod.findMany.mockResolvedValue([{ name: 'PIX' }, { name: 'Dinheiro' }]);

      await expect(service.remove(TENANT_A, 'acc-1')).rejects.toThrow(ConflictException);
      expect(prisma.financialTransaction.count).not.toHaveBeenCalled();
      expect(prisma.financialAccount.update).not.toHaveBeenCalled();
    });

    it('scopes the payment-method check by tenant', async () => {
      prisma.financialAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        name: 'Santander',
        balance: 0,
      });

      await service.remove(TENANT_A, 'acc-1');

      expect(prisma.paymentMethod.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_A, defaultAccountId: 'acc-1' },
        select: { name: true },
      });
    });
  });
});

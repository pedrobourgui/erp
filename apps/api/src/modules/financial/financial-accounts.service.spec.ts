import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
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
    financialAccount: { findFirst: jest.fn() },
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

  describe('transfer', () => {
    const dto = { fromAccountId: FROM_ID, toAccountId: TO_ID, amount: 200 };

    function mockAccountsFound() {
      prisma.financialAccount.findFirst
        .mockResolvedValueOnce({ id: FROM_ID, name: 'Caixa' })
        .mockResolvedValueOnce({ id: TO_ID, name: 'Conta Corrente' });
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
        .mockResolvedValueOnce({ id: FROM_ID, name: 'Caixa' })
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
        select: { id: true, name: true },
      });
    });
  });
});

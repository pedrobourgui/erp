import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FinancialReversalsService } from './financial-reversals.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * FN-04 — the most important bug of lote 5.
 *
 * `financial-entries.controller.ts` exposed `GET /`, `POST /` and
 * `POST /:id/settle` and nothing else: a settlement with the wrong amount or on
 * the wrong account could only be fixed by editing the database by hand.
 *
 * A reversal is a **new entry**, never an erasure: the original transaction
 * stays, and a mirrored one lands next to it. That is what makes the account
 * history auditable.
 */

const TENANT = 'tenant-uuid-001';
const USER = 'user-uuid-001';
const TITULO = 'ar-uuid-001';
const SETTLEMENT = 'trx-uuid-001';

function createMockPrisma() {
  const tx = {
    financialAccount: { update: jest.fn().mockResolvedValue({ balance: 900 }) },
    financialTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'trx-reversal', amount: 100 }),
      update: jest.fn().mockResolvedValue({}),
    },
    accountsReceivable: { update: jest.fn().mockResolvedValue({}) },
    accountsPayable: { update: jest.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    financialTransaction: { findFirst: jest.fn(), findMany: jest.fn() },
    accountsReceivable: { findFirst: jest.fn() },
    accountsPayable: { findFirst: jest.fn() },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };
}

describe('FinancialReversalsService', () => {
  let service: FinancialReversalsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { record: jest.Mock };

  /** A R$ 100 settlement on a R$ 300 receivable. */
  function settlementRow(overrides: Record<string, unknown> = {}) {
    return {
      id: SETTLEMENT,
      tenantId: TENANT,
      accountId: 'acc-1',
      type: 'CREDIT',
      amount: 100,
      description: 'Recebimento - PED-000010',
      referenceType: 'receivable',
      referenceId: TITULO,
      chartAccountId: null,
      metadata: null,
      createdAt: new Date('2026-07-20T12:00:00.000Z'),
      ...overrides,
    };
  }

  function receivableRow(overrides: Record<string, unknown> = {}) {
    return {
      id: TITULO,
      tenantId: TENANT,
      description: 'PED-000010 - Boleto',
      amount: 300,
      paidAmount: 100,
      status: 'PARTIALLY_PAID',
      dueDate: new Date('2026-08-10T03:00:00.000Z'),
      orderId: null,
      deletedAt: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReversalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(FinancialReversalsService);

    prisma.financialTransaction.findFirst.mockResolvedValue(settlementRow());
    prisma.accountsReceivable.findFirst.mockResolvedValue(receivableRow());
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Reversal of a partial settlement ──────────────────────────────────

  describe('reverseSettlement', () => {
    const reason = 'Baixa lançada na conta errada';

    it('gives the outstanding balance back to the título', async () => {
      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      expect(prisma.tx.accountsReceivable.update).toHaveBeenCalledWith({
        where: { id: TITULO },
        data: expect.objectContaining({ paidAmount: 0, status: 'PENDING' }),
      });
    });

    it('takes the money back out of the account it was credited to', async () => {
      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      expect(prisma.tx.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { decrement: 100 } },
        select: { balance: true },
      });
    });

    it('creates the opposite transaction instead of deleting the original', async () => {
      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      const created = prisma.tx.financialTransaction.create.mock.calls[0][0].data;
      expect(created).toMatchObject({
        tenantId: TENANT,
        accountId: 'acc-1',
        type: 'DEBIT', // mirror of the original CREDIT
        amount: 100,
        referenceType: 'reversal',
        referenceId: SETTLEMENT,
      });
      expect(created.description).toContain('Estorno');
      // The original is never removed — the history has to show both.
      expect(prisma.tx.financialTransaction.create).toHaveBeenCalledTimes(1);
    });

    it('mirrors a payable settlement in the other direction', async () => {
      prisma.financialTransaction.findFirst.mockResolvedValue(
        settlementRow({ type: 'DEBIT', referenceType: 'payable' }),
      );
      prisma.accountsPayable.findFirst.mockResolvedValue(receivableRow());
      prisma.accountsReceivable.findFirst.mockResolvedValue(null);

      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      expect(prisma.tx.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: { increment: 100 } },
        select: { balance: true },
      });
      expect(prisma.tx.accountsPayable.update).toHaveBeenCalled();
    });

    it('reverts a fully paid título to PARTIALLY_PAID when part remains settled', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(
        receivableRow({ paidAmount: 300, status: 'PAID' }),
      );
      prisma.financialTransaction.findFirst.mockResolvedValue(
        settlementRow({ amount: 100 }),
      );

      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      expect(prisma.tx.accountsReceivable.update).toHaveBeenCalledWith({
        where: { id: TITULO },
        data: expect.objectContaining({ paidAmount: 200, status: 'PARTIALLY_PAID' }),
      });
    });

    it('clears paidAt when the título is no longer fully paid', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(
        receivableRow({ paidAmount: 100, status: 'PAID', amount: 100 }),
      );

      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      const data = prisma.tx.accountsReceivable.update.mock.calls[0][0].data;
      expect(data.paidAt).toBeNull();
      expect(data.status).toBe('PENDING');
    });

    it('marks the original settlement as reversed so it cannot be reversed twice', async () => {
      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      const update = prisma.tx.financialTransaction.update.mock.calls[0][0];
      expect(update.where).toEqual({ id: SETTLEMENT });
      expect(update.data.metadata).toMatchObject({
        reversedBy: 'trx-reversal',
        reversedByUserId: USER,
        reversalReason: reason,
      });
    });

    it('refuses a second reversal of the same settlement', async () => {
      prisma.financialTransaction.findFirst.mockResolvedValue(
        settlementRow({ metadata: { reversedBy: 'trx-earlier' } }),
      );

      await expect(
        service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses to reverse a transaction that is not a settlement', async () => {
      prisma.financialTransaction.findFirst.mockResolvedValue(
        settlementRow({ referenceType: 'order' }),
      );

      await expect(
        service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses when the settlement belongs to another título', async () => {
      prisma.financialTransaction.findFirst.mockResolvedValue(
        settlementRow({ referenceId: 'other-titulo' }),
      );

      await expect(
        service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason }),
      ).rejects.toThrow(BadRequestException);
    });

    it('is scoped by tenant', async () => {
      prisma.financialTransaction.findFirst.mockResolvedValue(null);

      await expect(
        service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.financialTransaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: SETTLEMENT, tenantId: TENANT }),
        }),
      );
    });

    it('requires a reason', async () => {
      await expect(
        service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, {
          reason: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does everything in one transaction', async () => {
      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('records who reversed what, and why', async () => {
      await service.reverseSettlement(TENANT, USER, TITULO, SETTLEMENT, { reason });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          userId: USER,
          entity: 'FinancialTransaction',
          entityId: SETTLEMENT,
          action: 'UPDATE',
          metadata: expect.objectContaining({ reason }),
        }),
      );
    });
  });

  // ─── Settlement history ────────────────────────────────────────────────

  describe('listSettlements', () => {
    it('returns the settlements of a título with their reversal state', async () => {
      prisma.financialTransaction.findMany.mockResolvedValue([
        settlementRow({ metadata: { reversedBy: 'trx-9', reversalReason: 'erro' } }),
        settlementRow({ id: 'trx-2', amount: 50, metadata: null }),
      ]);

      const result = await service.listSettlements(TENANT, TITULO);

      expect(prisma.financialTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            referenceId: TITULO,
            referenceType: { in: ['receivable', 'payable'] },
          }),
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({ id: SETTLEMENT, amount: 100, isReversed: true }),
        expect.objectContaining({ id: 'trx-2', amount: 50, isReversed: false }),
      ]);
    });

    it('is empty for a título that was never settled', async () => {
      prisma.financialTransaction.findMany.mockResolvedValue([]);

      await expect(service.listSettlements(TENANT, TITULO)).resolves.toEqual([]);
    });
  });

  // ─── Edit ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('edits every field of a título with no settlement', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(
        receivableRow({ paidAmount: 0, status: 'PENDING' }),
      );

      await service.update(TENANT, USER, TITULO, {
        description: 'Nova descrição',
        amount: 450,
        dueDate: '2026-09-01',
      });

      const data = prisma.tx.accountsReceivable.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ description: 'Nova descrição', amount: 450 });
      expect(data.dueDate).toEqual(new Date('2026-09-01T03:00:00.000Z'));
    });

    it('refuses to change the amount of a título that already has a settlement', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(receivableRow());

      await expect(
        service.update(TENANT, USER, TITULO, { amount: 450 }),
      ).rejects.toThrow(ConflictException);
    });

    it('still allows description and category on a settled título', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(receivableRow());

      await service.update(TENANT, USER, TITULO, {
        description: 'Corrigindo o texto',
      });

      expect(prisma.tx.accountsReceivable.update).toHaveBeenCalled();
    });

    it('refuses to touch a título that came from an order', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(
        receivableRow({ orderId: 'order-1', paidAmount: 0, status: 'PENDING' }),
      );

      await expect(
        service.update(TENANT, USER, TITULO, { amount: 999 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Soft delete ───────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft deletes a título with no settlement', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(
        receivableRow({ paidAmount: 0, status: 'PENDING' }),
      );

      await service.remove(TENANT, USER, TITULO, { reason: 'Lançado em duplicidade' });

      const data = prisma.tx.accountsReceivable.update.mock.calls[0][0].data;
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.status).toBe('CANCELLED');
    });

    it('refuses to delete a título that has been settled', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(receivableRow());

      await expect(
        service.remove(TENANT, USER, TITULO, { reason: 'x' }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses to delete a título that came from an order', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(
        receivableRow({ orderId: 'order-1', paidAmount: 0, status: 'PENDING' }),
      );

      await expect(
        service.remove(TENANT, USER, TITULO, { reason: 'x' }),
      ).rejects.toThrow(ConflictException);
    });

    it('records the deletion with its reason', async () => {
      prisma.accountsReceivable.findFirst.mockResolvedValue(
        receivableRow({ paidAmount: 0, status: 'PENDING' }),
      );

      await service.remove(TENANT, USER, TITULO, { reason: 'Duplicado' });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entityId: TITULO }),
      );
    });
  });
});

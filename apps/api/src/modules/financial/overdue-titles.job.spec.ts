import { Test, TestingModule } from '@nestjs/testing';
import { OverdueTitlesJob } from './overdue-titles.job';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * FN-03: `grep -rn "OVERDUE" apps/api/src` used to find the enum and nothing
 * else — no code ever promoted a título. The list derives the status on read;
 * this job materialises it so filters, reports and integrations agree with the
 * screen instead of each deriving their own truth.
 */
describe('OverdueTitlesJob', () => {
  let job: OverdueTitlesJob;
  let prisma: {
    accountsReceivable: { updateMany: jest.Mock };
    accountsPayable: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      accountsReceivable: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      accountsPayable: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OverdueTitlesJob, { provide: PrismaService, useValue: prisma }],
    }).compile();

    job = module.get(OverdueTitlesJob);
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('marks receivables and payables due before today as OVERDUE', async () => {
    const result = await job.markOverdueTitles();

    // 2026-08-01 00:00 in America/Sao_Paulo is 03:00Z
    const midnight = new Date('2026-08-01T03:00:00.000Z');
    const expected = {
      where: {
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        dueDate: { lt: midnight },
      },
      data: { status: 'OVERDUE' },
    };

    expect(prisma.accountsReceivable.updateMany).toHaveBeenCalledWith(expected);
    expect(prisma.accountsPayable.updateMany).toHaveBeenCalledWith(expected);
    expect(result).toEqual({ receivables: 3, payables: 2 });
  });

  it('never touches a título due today', async () => {
    await job.markOverdueTitles();

    const { where } = prisma.accountsReceivable.updateMany.mock.calls[0][0];
    // Strictly before midnight: a título due today is not late yet.
    expect(where.dueDate.lt).toEqual(new Date('2026-08-01T03:00:00.000Z'));
    expect(where.dueDate.lte).toBeUndefined();
  });

  it('never touches a PAID, CANCELLED or already OVERDUE título', async () => {
    await job.markOverdueTitles();

    const { where } = prisma.accountsPayable.updateMany.mock.calls[0][0];
    expect(where.status).toEqual({ in: ['PENDING', 'PARTIALLY_PAID'] });
  });

  it('reports zero without failing when nothing is due', async () => {
    prisma.accountsReceivable.updateMany.mockResolvedValue({ count: 0 });
    prisma.accountsPayable.updateMany.mockResolvedValue({ count: 0 });

    await expect(job.markOverdueTitles()).resolves.toEqual({
      receivables: 0,
      payables: 0,
    });
  });

  it('does not let a failure on one side hide the other', async () => {
    prisma.accountsReceivable.updateMany.mockRejectedValue(new Error('db down'));

    await expect(job.markOverdueTitles()).rejects.toThrow('db down');
  });
});

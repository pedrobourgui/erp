import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FinancialStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DEFAULT_TENANT_TIMEZONE } from '../../common/utils/date-range.util';
import { startOfToday } from './financial-entries.service';

/**
 * FN-03: promotes open títulos past their due date to `OVERDUE`.
 *
 * The list also derives the status on read, on purpose — the two together are
 * what the plan asks for. Deriving alone would leave filters, reports and
 * integrations disagreeing with the screen; the job alone would leave a window
 * of up to a day where a título is late everywhere except in the database.
 *
 * Runs at 05:00 in the tenant timezone: after the day flipped, before anyone
 * opens the system.
 */
@Injectable()
export class OverdueTitlesJob {
  private readonly logger = new Logger(OverdueTitlesJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 5 * * *', {
    name: 'mark-overdue-titles',
    timeZone: DEFAULT_TENANT_TIMEZONE,
  })
  async handleCron(): Promise<void> {
    const { receivables, payables } = await this.markOverdueTitles();
    this.logger.log(
      `Overdue sweep: ${receivables} receivable(s) and ${payables} payable(s) marked OVERDUE`,
    );
  }

  /**
   * Not scoped by tenant on purpose: this is a maintenance sweep over every
   * tenant's data, and the rule ("due date has passed") is the same for all.
   * Every *read* path stays tenant-scoped.
   */
  async markOverdueTitles(): Promise<{ receivables: number; payables: number }> {
    const where = {
      // An already-OVERDUE título is left alone: re-writing it would churn
      // `updatedAt` every night for nothing.
      status: { in: ['PENDING', 'PARTIALLY_PAID'] as FinancialStatus[] },
      dueDate: { lt: startOfToday() },
    };
    const data = { status: 'OVERDUE' as const };

    const receivables = await this.prisma.accountsReceivable.updateMany({
      where,
      data,
    });
    const payables = await this.prisma.accountsPayable.updateMany({ where, data });

    return { receivables: receivables.count, payables: payables.count };
  }
}

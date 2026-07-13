import { Module } from '@nestjs/common';
import { FinancialAccountsController } from './financial-accounts.controller';
import { FinancialAccountsService } from './financial-accounts.service';
import { FinancialEntriesController } from './financial-entries.controller';
import { FinancialEntriesService } from './financial-entries.service';
import { FinancialSettlementsService } from './financial-settlements.service';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { ChartOfAccountsService } from './chart-of-accounts.service';

@Module({
  controllers: [
    FinancialAccountsController,
    FinancialEntriesController,
    ChartOfAccountsController,
  ],
  providers: [
    FinancialAccountsService,
    FinancialEntriesService,
    FinancialSettlementsService,
    ChartOfAccountsService,
  ],
  exports: [
    FinancialAccountsService,
    FinancialEntriesService,
    FinancialSettlementsService,
  ],
})
export class FinancialModule {}

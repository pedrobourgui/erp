import { Module } from '@nestjs/common';
import { FinancialAccountsController } from './financial-accounts.controller';
import { FinancialAccountsService } from './financial-accounts.service';

@Module({
  controllers: [FinancialAccountsController],
  providers: [FinancialAccountsService],
  exports: [FinancialAccountsService],
})
export class FinancialModule {}

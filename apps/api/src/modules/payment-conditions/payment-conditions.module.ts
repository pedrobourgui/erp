import { Module } from '@nestjs/common';
import { PaymentConditionsController } from './payment-conditions.controller';
import { PaymentConditionsService } from './payment-conditions.service';

@Module({
  controllers: [PaymentConditionsController],
  providers: [PaymentConditionsService],
  exports: [PaymentConditionsService],
})
export class PaymentConditionsModule {}

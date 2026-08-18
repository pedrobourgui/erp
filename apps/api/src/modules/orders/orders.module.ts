import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ExchangeOrderItemUseCase } from './use-cases/exchange-order-item.use-case';
import { ReverseSaleUseCase } from './use-cases/reverse-sale.use-case';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, ExchangeOrderItemUseCase, ReverseSaleUseCase],
  exports: [OrdersService],
})
export class OrdersModule {}

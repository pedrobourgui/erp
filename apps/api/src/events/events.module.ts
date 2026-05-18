import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventsService } from './events.service';
import { OrderEventsHandler } from './handlers/order-events.handler';
import { StockEventsHandler } from './handlers/stock-events.handler';
import { InventoryModule } from '../modules/inventory/inventory.module';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
    InventoryModule,
  ],
  providers: [EventsService, OrderEventsHandler, StockEventsHandler],
  exports: [EventsService],
})
export class EventsModule {}

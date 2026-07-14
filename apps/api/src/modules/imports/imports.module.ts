import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImportsController } from './imports.controller';
import { ImportsService, IMPORT_QUEUE } from './imports.service';
import { ImportsProcessor } from './imports.processor';

@Module({
  imports: [BullModule.registerQueue({ name: IMPORT_QUEUE })],
  controllers: [ImportsController],
  providers: [ImportsService, ImportsProcessor],
  exports: [ImportsService],
})
export class ImportsModule {}

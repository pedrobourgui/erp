import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Shared object-storage infrastructure (MinIO). Global so any domain module
 * (users avatar, products/CSV import) can inject StorageService without
 * creating cross-domain coupling.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

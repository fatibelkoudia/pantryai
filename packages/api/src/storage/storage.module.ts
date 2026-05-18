import { Module } from '@nestjs/common';
import { R2SweeperService } from './r2-sweeper.service.js';
import { R2StorageService } from './r2-storage.service.js';

@Module({
  providers: [R2StorageService, R2SweeperService],
  exports: [R2StorageService],
})
export class StorageModule {}

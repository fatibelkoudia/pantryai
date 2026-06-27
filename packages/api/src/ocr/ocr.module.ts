import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module.js';
import { runsBackgroundJobs } from '../common/background-jobs.js';
import { StorageModule } from '../storage/storage.module.js';
import { OcrController } from './ocr.controller.js';
import { OcrProcessor } from './ocr.processor.js';
import { OcrService } from './ocr.service.js';

// The controller (which enqueues jobs) is always here. The OcrProcessor (which
// consumes them) is only registered in a process that runs background work, so
// the API container can hand OCR off to the dedicated worker without both
// pulling the same job. See runsBackgroundJobs / RUN_OCR_WORKER.
@Module({
  imports: [AuthModule, StorageModule, BullModule.registerQueue({ name: 'ocr' })],
  controllers: [OcrController],
  providers: runsBackgroundJobs() ? [OcrService, OcrProcessor] : [OcrService],
  exports: [OcrService],
})
export class OcrModule {}

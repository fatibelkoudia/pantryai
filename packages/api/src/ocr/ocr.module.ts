import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module.js';
import { OcrController } from './ocr.controller.js';
import { OcrProcessor } from './ocr.processor.js';
import { OcrService } from './ocr.service.js';

@Module({
  imports: [forwardRef(() => AuthModule), BullModule.registerQueue({ name: 'ocr' })],
  controllers: [OcrController],
  providers: [OcrService, OcrProcessor],
  exports: [OcrService],
})
export class OcrModule {}

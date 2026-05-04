import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller.js';
import { LearningService } from './learning.service.js';

@Module({
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}

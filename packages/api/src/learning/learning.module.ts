import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module.js';
import { LearningController } from './learning.controller.js';
import { LearningService } from './learning.service.js';

// PrismaModule is global so we don't import it. GamificationModule gives us the
// streak that the complete-lesson response returns. The tips and their quizzes are
// bundled JSON (see tips.ts), so there is no generator to wire up here anymore.
@Module({
  imports: [GamificationModule],
  controllers: [LearningController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}

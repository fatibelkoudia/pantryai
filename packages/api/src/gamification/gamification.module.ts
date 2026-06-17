import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller.js';
import { GamificationService } from './gamification.service.js';

// We don't import PrismaModule (it's global) or EventEmitterModule (set up in
// AppModule), so we just need the controller and service here. The service is
// exported because the learning module returns the streak when a lesson is done.
@Module({
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}

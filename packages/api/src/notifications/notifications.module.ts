import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

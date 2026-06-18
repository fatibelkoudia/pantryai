import { Module } from '@nestjs/common';
import { WasteController } from './waste.controller.js';
import { WasteService } from './waste.service.js';

// PrismaModule is global, so we don't import it here.
@Module({
  controllers: [WasteController],
  providers: [WasteService],
})
export class WasteModule {}

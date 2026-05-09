import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { WasteService } from './waste.service.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

@ApiTags('waste')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('waste')
export class WasteController {
  constructor(private readonly wasteService: WasteService) {}

  @Get('level')
  @ApiOperation({
    summary: "The caller's Waste Level + Trashy's mood",
    description:
      'Score 0-100 (higher is better) over the trailing 30 days: consumed / (consumed + ' +
      'discarded + expired). Returns 100 / EXCELLENT when nothing has been resolved yet.',
  })
  @ApiResponse({ status: 200, description: 'Waste Level score, mood, window and counts' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getLevel(@Request() req: JwtRequest) {
    return this.wasteService.getLevel(req.user.userId);
  }
}

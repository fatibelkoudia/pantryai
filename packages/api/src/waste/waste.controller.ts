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
      'Score 0-100 (higher is better): 70% outcome + 30% pantry. The outcome part covers ' +
      "the trailing 30 days, recency weighted (an item's weight halves every 14 days) and " +
      'rescues (items eaten with 3 days or less left before expiry) count 1.5x. The pantry ' +
      'part looks at the stock right now: expired and soon-expiring items drag it down. ' +
      'Also returns the raw counts, the pantry state, a trend (last 7 days vs days 8-30), ' +
      'the score per week for the last 4 weeks, and how many more consumed items would ' +
      'reach the next mood (null + pantryBlocked when eating alone cannot get there). ' +
      'Returns 100 / EXCELLENT when nothing has been resolved and nothing is at risk.',
  })
  @ApiResponse({
    status: 200,
    description: 'Waste Level score, mood, window, counts, pantry, trend and weekly scores',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getLevel(@Request() req: JwtRequest) {
    return this.wasteService.getLevel(req.user.userId);
  }

  @Get('items')
  @ApiOperation({
    summary: 'The resolved items behind the waste counts',
    description:
      'The items resolved in the trailing 30 days (newest first, max 200): name, how they ' +
      'left the pantry, when, whether it was a rescue, and the CO2 estimate per consumed ' +
      'item. Also returns the CO2 factor table so the UI can show how the estimate works.',
  })
  @ApiResponse({ status: 200, description: 'Resolved items and the CO2 factors' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getItems(@Request() req: JwtRequest) {
    return this.wasteService.getItems(req.user.userId);
  }

  @Get('history')
  @ApiOperation({
    summary: 'All-time waste history by month',
    description:
      'One entry per calendar month (UTC) from the first resolved item to now, capped at ' +
      'the last 24 months: plain unweighted score plus the counts. Months with nothing ' +
      'resolved have a null score.',
  })
  @ApiResponse({ status: 200, description: 'Monthly scores and counts, oldest first' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getHistory(@Request() req: JwtRequest) {
    return this.wasteService.getHistory(req.user.userId);
  }
}

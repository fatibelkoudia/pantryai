import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GamificationService } from './gamification.service.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

@ApiTags('gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('challenges')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get()
  @ApiOperation({
    summary: "The caller's challenges + XP total",
    description:
      'Recomputes progress against current stock/shopping data, awards XP for any ' +
      'newly-completed challenge (exactly once), and returns every challenge with the ' +
      "caller's progress plus their running XP total.",
  })
  @ApiResponse({ status: 200, description: 'XP total and challenge progress' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getChallenges(@Request() req: JwtRequest) {
    return this.gamificationService.getChallenges(req.user.userId);
  }
}

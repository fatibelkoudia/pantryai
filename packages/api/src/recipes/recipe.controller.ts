import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RecipeService } from './recipe.service.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

@ApiTags('recipes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Get('suggest')
  @ApiOperation({
    summary: 'Suggest recipes from the user current stock',
    description:
      'Deterministic scoring (ingredients in stock / ingredients required). Returns recipes ' +
      'matching at least 70%, sorted best first, each with its missing ingredients. Uses ' +
      'TheMealDB when reachable and a bundled French recipe set as an offline fallback.',
  })
  @ApiResponse({ status: 200, description: 'Scored recipe suggestions' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  async suggest(@Request() req: JwtRequest) {
    const suggestions = await this.recipeService.suggest(req.user.userId);
    return { suggestions };
  }
}

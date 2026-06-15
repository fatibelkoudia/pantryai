import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TipsQueryDto } from './dto/tips-query.dto.js';
import { LearningService } from './learning.service.js';

// Tips are generic, static, non-PII content, so these endpoints are public.
@ApiTags('learning')
@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('tips')
  @ApiOperation({
    summary: 'List conservation tips',
    description:
      'Returns the static food-conservation tips (ANSES/ADEME). Pass a category to ' +
      'filter to one food group.',
  })
  @ApiResponse({ status: 200, description: 'Conservation tips' })
  getTips(@Query() query: TipsQueryDto) {
    return { tips: this.learningService.getTips(query.category) };
  }

  @Get('tips/random')
  @ApiOperation({
    summary: 'Get one random conservation tip',
    description:
      'Returns a single random tip, optionally within a category. `tip` is null if none match.',
  })
  @ApiResponse({ status: 200, description: 'A random conservation tip (or null)' })
  getRandomTip(@Query() query: TipsQueryDto) {
    return { tip: this.learningService.getRandomTip(query.category) };
  }
}

import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CompleteLessonDto } from './dto/complete-lesson.dto.js';
import { LessonQueryDto, TipsQueryDto } from './dto/tips-query.dto.js';
import { LearningService } from './learning.service.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

@ApiTags('learning')
@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  // Tips are generic, static, non-PII content, so these three stay public.

  @Get('tips')
  @ApiOperation({
    summary: 'List conservation tips',
    description:
      'Returns the food-conservation tips (ANSES/ADEME) in the requested language. ' +
      'Pass a category to filter to one food group.',
  })
  @ApiResponse({ status: 200, description: 'Conservation tips' })
  async getTips(@Query() query: TipsQueryDto) {
    return { tips: await this.learningService.getTips(query.category, query.locale) };
  }

  @Get('tips/random')
  @ApiOperation({
    summary: 'Get one random conservation tip',
    description:
      'Returns a single random tip, optionally within a category. `tip` is null if none match.',
  })
  @ApiResponse({ status: 200, description: 'A random conservation tip (or null)' })
  async getRandomTip(@Query() query: TipsQueryDto) {
    return { tip: await this.learningService.getRandomTip(query.category, query.locale) };
  }

  @Get('tips/daily')
  @ApiOperation({
    summary: 'Get the tip of the day',
    description:
      'Returns the daily tip. Picked from the date rather than at random, so every ' +
      'client sees the same tip all day in every language.',
  })
  @ApiResponse({ status: 200, description: 'The daily conservation tip' })
  async getDailyTip(@Query() query: LessonQueryDto) {
    return { tip: await this.learningService.getDailyTip(query.locale) };
  }

  // Lessons carry per-user completion state, so from here on a token is required.

  @Get('lessons')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "The lessons list with the caller's progress",
    description:
      'Every tip as a lesson in the requested language, with whether the caller ' +
      'already completed it and the overall completed count.',
  })
  @ApiResponse({ status: 200, description: 'Lessons with completion state' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getLessons(@Request() req: JwtRequest, @Query() query: TipsQueryDto) {
    return this.learningService.getLessons(req.user.userId, query.category, query.locale);
  }

  @Get('lessons/:tipId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'tipId', description: 'Id of the tip the lesson is built from' })
  @ApiOperation({
    summary: 'One full lesson with its quiz',
    description:
      'The lesson text and its multiple-choice question. The first request per ' +
      'language can take a few seconds while the quiz is generated; after that it ' +
      'is served from cache. `quiz` is null when no question could be generated.',
  })
  @ApiResponse({ status: 200, description: 'The lesson with its quiz' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 404, description: 'Unknown lesson' })
  async getLesson(
    @Request() req: JwtRequest,
    @Param('tipId') tipId: string,
    @Query() query: LessonQueryDto,
  ) {
    return { lesson: await this.learningService.getLesson(req.user.userId, tipId, query.locale) };
  }

  @Post('lessons/:tipId/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'tipId', description: 'Id of the tip the lesson is built from' })
  @ApiOperation({
    summary: 'Finish a lesson',
    description:
      'Records the completion, judges the picked answer when there was a quiz, and ' +
      'pays the lesson XP. The XP is only paid the first time; completing again just ' +
      'returns the reveal. The response carries the fresh XP total and daily streak.',
  })
  @ApiResponse({ status: 200, description: 'Result of the completion' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 404, description: 'Unknown lesson' })
  completeLesson(
    @Request() req: JwtRequest,
    @Param('tipId') tipId: string,
    @Query() query: LessonQueryDto,
    @Body() dto: CompleteLessonDto,
  ) {
    return this.learningService.completeLesson(
      req.user.userId,
      tipId,
      query.locale,
      dto.answerIndex,
    );
  }
}

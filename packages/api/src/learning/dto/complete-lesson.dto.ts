import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CompleteLessonDto {
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 2,
    description:
      'Index of the quiz choice the user picked. Left out when the lesson had no quiz ' +
      '(plain read-and-confirm).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  answerIndex?: number;
}

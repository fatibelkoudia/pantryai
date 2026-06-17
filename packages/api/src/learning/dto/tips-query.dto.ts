import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SUPPORTED_LOCALES, TIP_CATEGORIES, type Locale, type TipCategory } from '@pantryai/shared';

export class TipsQueryDto {
  @ApiPropertyOptional({
    enum: TIP_CATEGORIES,
    description: 'Filter tips to a single food category.',
  })
  @IsOptional()
  @IsIn(TIP_CATEGORIES)
  category?: TipCategory;

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'Language of the tip text. Defaults to French, the original content.',
  })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}

// The single-lesson endpoints take the same locale switch but no category.
export class LessonQueryDto {
  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'Language of the lesson text and quiz. Defaults to French.',
  })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}

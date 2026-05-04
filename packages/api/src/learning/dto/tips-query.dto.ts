import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { TIP_CATEGORIES, type TipCategory } from '@pantryai/shared';

export class TipsQueryDto {
  @ApiPropertyOptional({
    enum: TIP_CATEGORIES,
    description: 'Filter tips to a single food category.',
  })
  @IsOptional()
  @IsIn(TIP_CATEGORIES)
  category?: TipCategory;
}

import { ApiProperty } from '@nestjs/swagger';

export class UserSettingsResponseDto {
  @ApiProperty({ example: 'en' })
  locale!: string;

  @ApiProperty({ example: 1 })
  recipeMinMatchedItems!: number;

  @ApiProperty({ example: 0.7 })
  recipeMatchThreshold!: number;

  @ApiProperty({ example: 3 })
  expiringSoonDays!: number;

  @ApiProperty({ example: 1 })
  lowStockThreshold!: number;

  @ApiProperty({ example: 'PANTRY' })
  defaultStockLocation!: string;

  @ApiProperty()
  updatedAt!: Date;
}

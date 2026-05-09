import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const STOCK_DISPOSITIONS = ['CONSUMED', 'DISCARDED', 'EXPIRED'] as const;

export class DeleteStockQueryDto {
  @ApiPropertyOptional({
    enum: STOCK_DISPOSITIONS,
    description:
      'How the item left the pantry. Feeds the Waste Level score. When omitted, the API infers ' +
      'EXPIRED for items past their expiration date, otherwise CONSUMED.',
  })
  @IsIn(STOCK_DISPOSITIONS)
  @IsOptional()
  disposition?: (typeof STOCK_DISPOSITIONS)[number];
}

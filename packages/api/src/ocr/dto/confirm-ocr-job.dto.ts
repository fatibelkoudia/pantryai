import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

export class ConfirmOcrJobDto {
  @ApiProperty({
    description: "Indices into the job's parsedItems of the items to add to stock",
    example: [0, 1, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  indices!: number[];
}

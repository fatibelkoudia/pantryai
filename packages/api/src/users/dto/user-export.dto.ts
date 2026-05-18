import { ApiProperty } from '@nestjs/swagger';

class ExportProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

class ExportStockItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  product!: string;

  @ApiProperty({ nullable: true, type: String })
  ean13!: string | null;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  unit!: string;

  @ApiProperty({ nullable: true, type: Date })
  expirationDate!: Date | null;

  @ApiProperty()
  location!: string;

  @ApiProperty()
  addedAt!: Date;
}

class ExportOcrJobDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true, type: String })
  retailer!: string | null;

  @ApiProperty({ description: 'Parsed receipt line items (no image is ever stored or exported)' })
  parsedItems!: unknown;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true, type: Date })
  completedAt!: Date | null;
}

// RGPD Article 20: a copy of everything we hold about a user.
// We never include receipt images. They only live in R2 for up to 24h and aren't part of
// the user's stored record anyway.
export class UserExportDto {
  @ApiProperty()
  exportedAt!: Date;

  @ApiProperty({ type: ExportProfileDto })
  profile!: ExportProfileDto;

  @ApiProperty({ type: [ExportStockItemDto] })
  stockItems!: ExportStockItemDto[];

  @ApiProperty({ type: [ExportOcrJobDto] })
  ocrJobs!: ExportOcrJobDto[];
}

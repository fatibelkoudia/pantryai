import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class ScanQrDto {
  @ApiProperty({ example: 'https://receipts.carrefour.fr/ticket/abc123' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: true },
    { message: 'url must be a valid http or https URL' },
  )
  url!: string;
}

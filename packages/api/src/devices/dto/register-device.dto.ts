import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @IsNotEmpty()
  expoPushToken!: string;

  @ApiProperty({ example: 'ios', enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}

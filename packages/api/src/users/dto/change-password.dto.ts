import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldpassword1' })
  @IsString()
  currentPassword!: string;

  // same minimum as on register, so you can't downgrade your password here
  @ApiProperty({ example: 'newpassword1', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

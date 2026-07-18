import { ApiPropertyOptional } from '@nestjs/swagger';
import { avatarPresets } from '@pantryai/shared';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// only ids we actually ship as presets are accepted
const AVATAR_IDS = avatarPresets.map((preset) => preset.id);

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Tima' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'chef', enum: AVATAR_IDS })
  @IsIn(AVATAR_IDS)
  @IsOptional()
  avatarId?: string;
}

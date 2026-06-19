import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto.js';
import { UserExportDto } from './dto/user-export.dto.js';
import { UserSettingsResponseDto } from './dto/user-settings-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @ApiOperation({
    summary: 'Update the profile of the authenticated user',
    description:
      'Name, email and avatar. Email changes apply immediately (there is no confirmation email).',
  })
  @ApiResponse({ status: 200, description: 'The updated profile', type: ProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 409, description: 'Email is already in use by another account' })
  updateMe(
    @Request() req: { user: JwtUser },
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change the password of the authenticated user' })
  @ApiResponse({ status: 204, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Wrong current password or invalid token' })
  changePassword(@Request() req: { user: JwtUser }, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.usersService.changePassword(req.user.userId, dto);
  }

  @Post('me/onboarding/complete')
  @ApiOperation({
    summary: 'Mark the first-run onboarding as done for the authenticated user',
    description:
      'Finishing and skipping both count. Idempotent: calling it again keeps the original date.',
  })
  @ApiResponse({ status: 201, description: 'The updated profile', type: ProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  completeOnboarding(@Request() req: { user: JwtUser }): Promise<ProfileResponseDto> {
    return this.usersService.completeOnboarding(req.user.userId);
  }

  @Get('me/settings')
  @ApiOperation({
    summary: 'Get the settings of the authenticated user',
    description: 'Creates the row with default values the first time it is read.',
  })
  @ApiResponse({ status: 200, description: 'The user settings', type: UserSettingsResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getSettings(@Request() req: { user: JwtUser }): Promise<UserSettingsResponseDto> {
    return this.usersService.getSettings(req.user.userId);
  }

  @Patch('me/settings')
  @ApiOperation({ summary: 'Update the settings of the authenticated user (partial)' })
  @ApiResponse({ status: 200, description: 'The updated settings', type: UserSettingsResponseDto })
  @ApiResponse({ status: 400, description: 'A value is out of its allowed range' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  updateSettings(
    @Request() req: { user: JwtUser },
    @Body() dto: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    return this.usersService.updateSettings(req.user.userId, dto);
  }

  @Get('me/export')
  @ApiOperation({
    summary: 'Export all data held about the authenticated user (RGPD Article 20)',
    description:
      'Returns the profile, settings, stock items, and OCR job metadata as JSON. Receipt images are never included.',
  })
  @ApiResponse({ status: 200, description: 'The user data export', type: UserExportDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  exportMe(@Request() req: { user: JwtUser }): Promise<UserExportDto> {
    return this.usersService.exportUserData(req.user.userId);
  }
}

import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtUser } from '../auth/strategies/jwt.strategy.js';
import { UserExportDto } from './dto/user-export.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Export all data held about the authenticated user (RGPD Article 20)',
    description:
      'Returns the profile, stock items, and OCR job metadata as JSON. Receipt images are never included.',
  })
  @ApiResponse({ status: 200, description: 'The user data export', type: UserExportDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  exportMe(@Request() req: { user: JwtUser }): Promise<UserExportDto> {
    return this.usersService.exportUserData(req.user.userId);
  }
}

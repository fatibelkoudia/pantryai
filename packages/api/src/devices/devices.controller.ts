import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DevicesService } from './devices.service.js';
import { RegisterDeviceDto } from './dto/register-device.dto.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @ApiOperation({ summary: "Register the caller's Expo push token for expiration alerts" })
  @ApiResponse({ status: 201, description: 'Device registered' })
  register(@Body() dto: RegisterDeviceDto, @Request() req: JwtRequest) {
    return this.devicesService.register(req.user.userId, dto);
  }
}

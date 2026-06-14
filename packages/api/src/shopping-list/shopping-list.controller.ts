import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateShoppingItemDto } from './dto/create-shopping-item.dto.js';
import { GenerateShoppingListDto } from './dto/generate-shopping-list.dto.js';
import { UpdateShoppingItemDto } from './dto/update-shopping-item.dto.js';
import { ShoppingListService } from './shopping-list.service.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

@ApiTags('shopping-list')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shopping-list')
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) {}

  @Get()
  @ApiOperation({ summary: 'List the shopping items for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Shopping list (unchecked items first)' })
  findAll(@Request() req: JwtRequest) {
    return this.shoppingListService.findAll(req.user.userId);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate the shopping list from low/expiring stock and recipe gaps',
    description:
      'Merges low-stock and soon-to-expire stock items with the missing ingredients of the ' +
      "chosen recipes (or the user's suggested recipes when none are given), deduped by name. " +
      'Items already on the list are kept and never duplicated.',
  })
  @ApiResponse({ status: 200, description: 'The updated, deduped shopping list' })
  generate(@Body() dto: GenerateShoppingListDto, @Request() req: JwtRequest) {
    return this.shoppingListService.generate(req.user.userId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Add a manual shopping item' })
  @ApiResponse({ status: 201, description: 'Shopping item created' })
  create(@Body() dto: CreateShoppingItemDto, @Request() req: JwtRequest) {
    return this.shoppingListService.create(req.user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shopping item (check/uncheck, edit), user-scoped' })
  @ApiParam({ name: 'id', description: 'Shopping item ID' })
  @ApiResponse({ status: 200, description: 'Shopping item updated' })
  @ApiResponse({ status: 404, description: 'Shopping item not found' })
  update(@Param('id') id: string, @Body() dto: UpdateShoppingItemDto, @Request() req: JwtRequest) {
    return this.shoppingListService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a shopping item (user-scoped)' })
  @ApiParam({ name: 'id', description: 'Shopping item ID' })
  @ApiResponse({ status: 204, description: 'Shopping item removed' })
  @ApiResponse({ status: 404, description: 'Shopping item not found' })
  remove(@Param('id') id: string, @Request() req: JwtRequest) {
    return this.shoppingListService.remove(id, req.user.userId);
  }
}

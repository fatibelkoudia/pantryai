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
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateStockItemDto } from './dto/create-stock-item.dto.js';
import { DeleteStockQueryDto } from './dto/delete-stock-query.dto.js';
import { StockQueryDto } from './dto/stock-query.dto.js';
import { UpdateStockItemDto } from './dto/update-stock-item.dto.js';
import { StockService } from './stock.service.js';

interface JwtRequest {
  user: { userId: string; email: string };
}

@ApiTags('stocks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stocks')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ApiOperation({ summary: 'List stock items for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Paginated stock item list with product details' })
  findAll(@Request() req: JwtRequest, @Query() query: StockQueryDto) {
    return this.stockService.findAll(req.user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a stock item by ID (user-scoped)' })
  @ApiParam({ name: 'id', description: 'Stock item ID' })
  @ApiResponse({ status: 200, description: 'Stock item found' })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  findOne(@Param('id') id: string, @Request() req: JwtRequest) {
    return this.stockService.findOne(id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a product to stock' })
  @ApiResponse({ status: 201, description: 'Stock item created' })
  create(@Body() dto: CreateStockItemDto, @Request() req: JwtRequest) {
    return this.stockService.create(req.user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a stock item (user-scoped)' })
  @ApiResponse({ status: 200, description: 'Stock item updated' })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  update(@Param('id') id: string, @Body() dto: UpdateStockItemDto, @Request() req: JwtRequest) {
    return this.stockService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a stock item (user-scoped)',
    description:
      'Records how the item left the pantry via the optional ?disposition= query param ' +
      '(CONSUMED | DISCARDED | EXPIRED) for the Waste Level score.',
  })
  @ApiResponse({ status: 204, description: 'Stock item deleted' })
  @ApiResponse({ status: 404, description: 'Stock item not found' })
  remove(@Param('id') id: string, @Query() query: DeleteStockQueryDto, @Request() req: JwtRequest) {
    return this.stockService.remove(id, req.user.userId, query.disposition);
  }
}

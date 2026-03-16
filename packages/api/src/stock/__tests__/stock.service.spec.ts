import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StockService } from '../stock.service.js';

const mockProduct = {
  id: 'prod-uuid-1',
  name: 'Greek Yogurt',
  brand: 'Danone',
  ean13: '3033490004934',
  category: 'Dairy',
  imageUrl: null,
  nutritionData: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockStockItem = {
  id: 'stock-uuid-1',
  userId: 'user-uuid-1',
  productId: 'prod-uuid-1',
  quantity: 2,
  unit: 'kg',
  expirationDate: new Date('2026-06-01'),
  location: 'FRIDGE' as const,
  addedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  product: mockProduct,
};

const mockPrismaService = {
  stockItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
  },
};

describe('StockService', () => {
  let service: StockService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StockService(mockPrismaService as never);
  });

  describe('findAll', () => {
    it('returns paginated stock items for the user', async () => {
      mockPrismaService.stockItem.findMany.mockResolvedValue([mockStockItem]);
      mockPrismaService.stockItem.count.mockResolvedValue(1);

      const result = await service.findAll('user-uuid-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(mockPrismaService.stockItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-uuid-1', deletedAt: null }),
        }),
      );
    });

    it('filters by location', async () => {
      mockPrismaService.stockItem.findMany.mockResolvedValue([mockStockItem]);
      mockPrismaService.stockItem.count.mockResolvedValue(1);

      await service.findAll('user-uuid-1', { location: 'FRIDGE' as never });

      expect(mockPrismaService.stockItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ location: 'FRIDGE' }),
        }),
      );
    });

    it('filters by search term', async () => {
      mockPrismaService.stockItem.findMany.mockResolvedValue([mockStockItem]);
      mockPrismaService.stockItem.count.mockResolvedValue(1);

      await service.findAll('user-uuid-1', { search: 'yogurt' });

      expect(mockPrismaService.stockItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: { name: { contains: 'yogurt', mode: 'insensitive' } },
          }),
        }),
      );
    });

    it('filters by expiringSoon', async () => {
      mockPrismaService.stockItem.findMany.mockResolvedValue([mockStockItem]);
      mockPrismaService.stockItem.count.mockResolvedValue(1);

      await service.findAll('user-uuid-1', { expiringSoon: true });

      expect(mockPrismaService.stockItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expirationDate: expect.objectContaining({ not: null }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a stock item for the owner', async () => {
      mockPrismaService.stockItem.findFirst.mockResolvedValue(mockStockItem);

      const result = await service.findOne('stock-uuid-1', 'user-uuid-1');

      expect(result).toEqual(mockStockItem);
    });

    it('throws NotFoundException when item not found', async () => {
      mockPrismaService.stockItem.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when item belongs to another user', async () => {
      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        ...mockStockItem,
        userId: 'other-user',
      });

      await expect(service.findOne('stock-uuid-1', 'user-uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('creates a stock item for the user', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.stockItem.create.mockResolvedValue(mockStockItem);

      const result = await service.create('user-uuid-1', {
        productId: 'prod-uuid-1',
        quantity: 2,
        unit: 'kg',
      });

      expect(result).toEqual(mockStockItem);
      expect(mockPrismaService.stockItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-uuid-1', productId: 'prod-uuid-1' }),
        }),
      );
    });

    it('throws NotFoundException when the productId does not exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-uuid-1', { productId: 'missing-product', quantity: 1, unit: 'unit' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.stockItem.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a stock item', async () => {
      mockPrismaService.stockItem.findFirst.mockResolvedValue(mockStockItem);
      mockPrismaService.stockItem.update.mockResolvedValue({ ...mockStockItem, quantity: 5 });

      const result = await service.update('stock-uuid-1', 'user-uuid-1', { quantity: 5 });

      expect(result.quantity).toBe(5);
    });

    it('throws NotFoundException when item not found', async () => {
      mockPrismaService.stockItem.findFirst.mockResolvedValue(null);

      await expect(service.update('nonexistent', 'user-uuid-1', { quantity: 5 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes a stock item by setting deletedAt', async () => {
      mockPrismaService.stockItem.findFirst.mockResolvedValue(mockStockItem);
      mockPrismaService.stockItem.update.mockResolvedValue({
        ...mockStockItem,
        deletedAt: new Date(),
      });

      await service.remove('stock-uuid-1', 'user-uuid-1');

      expect(mockPrismaService.stockItem.update).toHaveBeenCalledWith({
        where: { id: 'stock-uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('throws NotFoundException when item not found', async () => {
      mockPrismaService.stockItem.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-uuid-1')).rejects.toThrow(NotFoundException);
    });
  });
});

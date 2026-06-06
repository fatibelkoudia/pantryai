import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductService } from '../product.service.js';

const mockProduct = {
  id: 'prod-uuid-1',
  name: 'Greek Yogurt',
  brand: 'Danone',
  ean13: '3033490004934',
  category: 'Dairy',
  imageUrl: 'https://images.openfoodfacts.org/yogurt.jpg',
  nutritionData: { energy: 100 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrismaService = {
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductService(mockPrismaService as never);
  });

  describe('findAll', () => {
    it('returns paginated products', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.product.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('uses defaults when page/limit not provided', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      const result = await service.findAll({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('filters by name (case-insensitive) when search is provided', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAll({ search: 'yog' });

      const expectedWhere = { name: { contains: 'yog', mode: 'insensitive' } };
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrismaService.product.count).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('trims whitespace-only search to no filter', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await service.findAll({ search: '   ' });

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a product when found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne('prod-uuid-1');

      expect(result).toEqual(mockProduct);
      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-uuid-1' },
      });
    });

    it('throws NotFoundException when product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a product', async () => {
      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create({ name: 'Greek Yogurt', brand: 'Danone' });

      expect(result).toEqual(mockProduct);
      expect(mockPrismaService.product.create).toHaveBeenCalled();
    });

    it('parses valid nutritionData JSON', async () => {
      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      await service.create({ name: 'Greek Yogurt', nutritionData: '{"energy":100}' });

      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nutritionData: { energy: 100 } }),
        }),
      );
    });

    it('throws BadRequestException when nutritionData is not valid JSON', async () => {
      await expect(service.create({ name: 'Bad', nutritionData: 'not-json' })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.product.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.update.mockResolvedValue({ ...mockProduct, name: 'Updated' });

      const result = await service.update('prod-uuid-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException when product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.delete.mockResolvedValue(mockProduct);

      await service.remove('prod-uuid-1');

      expect(mockPrismaService.product.delete).toHaveBeenCalledWith({
        where: { id: 'prod-uuid-1' },
      });
    });

    it('throws NotFoundException when product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEan13', () => {
    it('returns existing product from DB without calling Open Food Facts', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findByEan13('3033490004934');

      expect(result).toEqual(mockProduct);
      expect(mockPrismaService.product.create).not.toHaveBeenCalled();
    });

    it('fetches from Open Food Facts and saves when not in DB', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 1,
          product: {
            product_name: 'Greek Yogurt',
            brands: 'Danone',
            categories_tags: ['en:dairy'],
            image_front_url: 'https://images.openfoodfacts.org/yogurt.jpg',
            nutriments: { energy: 100 },
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await service.findByEan13('3033490004934');

      expect(result).toEqual(mockProduct);
      expect(mockPrismaService.product.create).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('throws NotFoundException when not in DB and not on Open Food Facts', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 0 }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(service.findByEan13('0000000000000')).rejects.toThrow(NotFoundException);

      vi.unstubAllGlobals();
    });
  });
});

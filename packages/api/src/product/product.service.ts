import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  image_front_url?: string;
  nutriments?: Record<string, string | number | boolean | null>;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProductQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search?.trim();
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        brand: dto.brand ?? null,
        ean13: dto.ean13 ?? null,
        category: dto.category ?? null,
        imageUrl: dto.imageUrl ?? null,
        ...(dto.nutritionData !== undefined && {
          nutritionData: this.parseNutritionData(dto.nutritionData),
        }),
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.ean13 !== undefined && { ean13: dto.ean13 }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.nutritionData !== undefined && {
          nutritionData: this.parseNutritionData(dto.nutritionData),
        }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  async findByEan13(ean13: string) {
    const existing = await this.prisma.product.findUnique({ where: { ean13 } });
    if (existing) return existing;

    const offProduct = await this.fetchFromOpenFoodFacts(ean13);
    if (!offProduct) throw new NotFoundException(`No product found for EAN-13: ${ean13}`);

    return this.prisma.product.create({
      data: {
        name: offProduct.product_name ?? ean13,
        brand: offProduct.brands ?? null,
        ean13,
        category: offProduct.categories_tags?.[0]?.replace('en:', '') ?? null,
        imageUrl: offProduct.image_front_url ?? null,
        ...(offProduct.nutriments !== undefined && { nutritionData: offProduct.nutriments }),
      },
    });
  }

  private async fetchFromOpenFoodFacts(ean13: string): Promise<OpenFoodFactsProduct | null> {
    const url = `https://world.openfoodfacts.org/api/v2/product/${ean13}.json`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PantryAI/1.0 (pantryai@example.com)' },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as OpenFoodFactsResponse;
    if (data.status !== 1 || !data.product) return null;

    return data.product;
  }

  private parseNutritionData(raw: string): object {
    try {
      return JSON.parse(raw) as object;
    } catch {
      throw new BadRequestException('nutritionData must be valid JSON');
    }
  }
}

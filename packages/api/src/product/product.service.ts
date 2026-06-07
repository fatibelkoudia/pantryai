import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
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

// How long we trust a cached Open Food Facts response.
const OFF_CACHE_PREFIX = 'off:product:';
const OFF_HIT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days for a product we found
const OFF_MISS_TTL_SECONDS = 60 * 60; // 1 hour for a "not found" so new OFF products can show up later
// Open Food Facts asks us to stay polite, so cap live calls to under 1 per second.
const OFF_MIN_INTERVAL_MS = 1000;

@Injectable()
export class ProductService {
  // Used to space out live OFF calls. Each live call waits its turn behind the
  // previous one, then waits until at least OFF_MIN_INTERVAL_MS has passed.
  private offFetchChain: Promise<unknown> = Promise.resolve();
  private lastOffFetchAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

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

  // Look up a product on Open Food Facts, but check Redis first. A cache hit
  // means we never touch OFF, which keeps repeat scans fast and lets us still
  // answer for known products when OFF is down (risk R5).
  // TODO: monthly OFF dump import. Download the OFF data dump (filtered to FR
  // supermarket products) into the local `products` table on a schedule so we
  // have an offline fallback even for EANs we've never scanned. Out of scope here.
  private async fetchFromOpenFoodFacts(ean13: string): Promise<OpenFoodFactsProduct | null> {
    const cacheKey = OFF_CACHE_PREFIX + ean13;

    const cached = await this.readOffCache(cacheKey);
    if (cached !== undefined) return cached;

    let product: OpenFoodFactsProduct | null;
    try {
      product = await this.rateLimitedOffFetch(ean13);
    } catch {
      // OFF is unreachable and we have nothing cached. Treat it as "not found"
      // for this request but don't cache it, so we retry next time.
      return null;
    }

    await this.writeOffCache(cacheKey, product);
    return product;
  }

  // Reads the cache. We get back undefined if nothing is cached yet, the product
  // if we found one before, or null if we cached a "not found". If Redis is
  // acting up we just say "nothing cached" so a lookup never breaks.
  private async readOffCache(key: string): Promise<OpenFoodFactsProduct | null | undefined> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as OpenFoodFactsProduct | null;
    } catch {
      return undefined;
    }
  }

  private async writeOffCache(key: string, value: OpenFoodFactsProduct | null): Promise<void> {
    try {
      const ttl = value ? OFF_HIT_TTL_SECONDS : OFF_MISS_TTL_SECONDS;
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch {
      // Couldn't cache it. The caller already has the live result, so just move on.
    }
  }

  // Runs live OFF calls one at a time and keeps them under 1 per second. Each
  // call waits for the one before it, then waits out the rest of the second.
  private rateLimitedOffFetch(ean13: string): Promise<OpenFoodFactsProduct | null> {
    const run = this.offFetchChain.then(async () => {
      const wait = OFF_MIN_INTERVAL_MS - (Date.now() - this.lastOffFetchAt);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastOffFetchAt = Date.now();
      return this.callOpenFoodFacts(ean13);
    });
    // Keep the chain going even if this call fails, so one error doesn't wedge the queue.
    this.offFetchChain = run.catch(() => undefined);
    return run;
  }

  private async callOpenFoodFacts(ean13: string): Promise<OpenFoodFactsProduct | null> {
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

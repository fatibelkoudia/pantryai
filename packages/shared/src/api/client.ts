import type { ApiResponse } from '../types/api.js';
import type { AuthResponse, AuthTokens, LoginDto, RegisterDto } from '../types/auth.js';
import type { OcrJob } from '../types/ocr.js';
import type { Product } from '../types/product.js';
import type { CreateStockItemDto, StockItem } from '../types/stock.js';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class PantryApiClient {
  private accessToken: string | null = null;

  constructor(private readonly baseUrl: string) {}

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const body = (await response.json()) as ApiResponse<T>;

    if (!response.ok || !body.success) {
      throw new ApiClientError(
        body.error?.code ?? 'UNKNOWN_ERROR',
        body.error?.message ?? 'An unexpected error occurred',
        response.status,
      );
    }

    return body.data as T;
  }

  // Auth
  register(dto: RegisterDto): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  login(dto: LoginDto): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // Products
  getProductByEan13(ean13: string): Promise<Product> {
    return this.request<Product>(`/products/ean/${ean13}`);
  }

  // Stock
  createStockItem(dto: CreateStockItemDto): Promise<StockItem> {
    return this.request<StockItem>('/stocks', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  // OCR / QR receipts
  scanQrReceipt(url: string): Promise<{ jobId: string }> {
    return this.request<{ jobId: string }>('/ocr/scan-qr', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  getOcrJob(jobId: string): Promise<OcrJob> {
    return this.request<OcrJob>(`/ocr/jobs/${jobId}`);
  }
}

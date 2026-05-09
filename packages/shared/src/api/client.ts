import type { ApiMeta, ApiResponse } from '../types/api.js';
import type { AuthResponse, LoginDto, RegisterDto } from '../types/auth.js';
import type { RegisterDeviceDto } from '../types/device.js';
import type { RandomTipResponse, TipCategory, TipsResponse } from '../types/learning.js';
import type { OcrJob } from '../types/ocr.js';
import type { CreateProductDto, Product, ProductQuery } from '../types/product.js';
import type { RecipeSuggestionsResponse } from '../types/recipe.js';
import type {
  CreateShoppingItemDto,
  GenerateShoppingListDto,
  ShoppingItem,
  ShoppingListResponse,
  UpdateShoppingItemDto,
} from '../types/shopping.js';
import type {
  CreateStockItemDto,
  StockItemWithProduct,
  StockQuery,
  UpdateStockItemDto,
} from '../types/stock.js';
import type { StockDisposition, WasteLevelResponse } from '../types/waste.js';

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

export interface ScanReceiptOptions {
  onUploadProgress?: (percent: number) => void;
  signal?: AbortSignal;
  /**
   * When false, the receipt is parsed but items are NOT added to stock — the caller then
   * confirms a selection via `confirmOcrJob`. Defaults to true (immediate add).
   */
  autoCommit?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export class PantryApiClient {
  private accessToken: string | null = null;
  private refreshHandler: (() => Promise<string | null>) | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  // lets you set a function that gives back a new access token when a request fails with 401
  // the client calls it once, uses the new token and retries the request a single time
  // return null if you can't refresh and the 401 just goes through (so the caller can log out)
  // it's optional, the web app leaves it unset because it refreshes with a cookie instead
  setRefreshHandler(handler: (() => Promise<string | null>) | null): void {
    this.refreshHandler = handler;
  }

  private authHeaders(): Record<string, string> {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  private async request<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
    try {
      return await this.performRequest<T>(path, init);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.status === 401 &&
        allowRefresh &&
        this.refreshHandler
      ) {
        const newToken = await this.refreshHandler();
        if (newToken) {
          this.setAccessToken(newToken);
          return this.request<T>(path, init, false);
        }
      }
      throw error;
    }
  }

  private async performRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiClientError('TIMEOUT', `Request to ${path} timed out`, 0);
      }
      throw new ApiClientError(
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Network request failed',
        0,
      );
    } finally {
      clearTimeout(timeout);
    }

    // 204 No Content (e.g. DELETE) and empty bodies have no JSON to parse.
    if (response.status === 204) {
      return undefined as T;
    }

    let body: ApiResponse<T> | null = null;
    const text = await response.text();
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as ApiResponse<T>;
      } catch {
        if (!response.ok) {
          throw new ApiClientError('UNKNOWN_ERROR', text || response.statusText, response.status);
        }
        return undefined as T;
      }
    }

    if (!response.ok || !body || body.success === false) {
      throw new ApiClientError(
        body?.error?.code ?? 'UNKNOWN_ERROR',
        body?.error?.message ?? 'An unexpected error occurred',
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

  /** The API issues a new access token only — the refresh token is not rotated. */
  refresh(refreshToken: string): Promise<{ accessToken: string }> {
    return this.request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  // Products
  listProducts(query: ProductQuery = {}): Promise<{ items: Product[]; meta: ApiMeta }> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    return this.request<{ items: Product[]; meta: ApiMeta }>(`/products${qs ? `?${qs}` : ''}`);
  }

  getProductByEan13(ean13: string): Promise<Product> {
    return this.request<Product>(`/products/ean/${ean13}`);
  }

  createProduct(dto: CreateProductDto): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  // Stock
  listStocks(query: StockQuery = {}): Promise<{ items: StockItemWithProduct[]; meta: ApiMeta }> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    return this.request<{ items: StockItemWithProduct[]; meta: ApiMeta }>(
      `/stocks${qs ? `?${qs}` : ''}`,
    );
  }

  getStock(id: string): Promise<StockItemWithProduct> {
    return this.request<StockItemWithProduct>(`/stocks/${id}`);
  }

  createStockItem(dto: CreateStockItemDto): Promise<StockItemWithProduct> {
    return this.request<StockItemWithProduct>('/stocks', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  updateStock(id: string, dto: UpdateStockItemDto): Promise<StockItemWithProduct> {
    return this.request<StockItemWithProduct>(`/stocks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  }

  /** Remove a stock item. `disposition` records how it left the pantry for the Waste Level. */
  deleteStock(id: string, disposition?: StockDisposition): Promise<void> {
    const qs = disposition ? `?disposition=${disposition}` : '';
    return this.request<void>(`/stocks/${id}${qs}`, { method: 'DELETE' });
  }

  // Waste Level / Trashy mood
  /** The caller's Waste Level over the trailing window: score 0-100 + mascot mood. */
  getWasteLevel(): Promise<WasteLevelResponse> {
    return this.request<WasteLevelResponse>('/waste/level');
  }

  // Recipes
  /** Suggest recipes scored against the caller's current stock (>= 70% match). */
  suggestRecipes(): Promise<RecipeSuggestionsResponse> {
    return this.request<RecipeSuggestionsResponse>('/recipes/suggest');
  }

  // Learning / conservation tips
  /** Conservation tips, optionally filtered to a single category. */
  getTips(category?: TipCategory): Promise<TipsResponse> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<TipsResponse>(`/learning/tips${qs}`);
  }

  /** One random conservation tip, optionally within a category. `tip` is null if none match. */
  getRandomTip(category?: TipCategory): Promise<RandomTipResponse> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<RandomTipResponse>(`/learning/tips/random${qs}`);
  }

  // Shopping list
  getShoppingList(): Promise<ShoppingListResponse> {
    return this.request<ShoppingListResponse>('/shopping-list');
  }

  /** Build a deduped list from low/expiring stock + missing recipe ingredients. */
  generateShoppingList(dto: GenerateShoppingListDto = {}): Promise<ShoppingListResponse> {
    return this.request<ShoppingListResponse>('/shopping-list/generate', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  addShoppingItem(dto: CreateShoppingItemDto): Promise<ShoppingItem> {
    return this.request<ShoppingItem>('/shopping-list', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  updateShoppingItem(id: string, dto: UpdateShoppingItemDto): Promise<ShoppingItem> {
    return this.request<ShoppingItem>(`/shopping-list/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  }

  deleteShoppingItem(id: string): Promise<void> {
    return this.request<void>(`/shopping-list/${id}`, { method: 'DELETE' });
  }

  // Devices / push notifications
  registerDevice(dto: RegisterDeviceDto): Promise<void> {
    return this.request<void>('/devices/register', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  // OCR / receipts
  /**
   * Upload a receipt image for async OCR. Uses XMLHttpRequest so upload progress is
   * observable (fetch cannot report upload progress) — works in the browser and React Native.
   */
  scanReceipt(file: Blob, options: ScanReceiptOptions = {}): Promise<{ jobId: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);

      const query = options.autoCommit === false ? '?autoCommit=false' : '';
      xhr.open('POST', `${this.baseUrl}/ocr/scan${query}`);
      xhr.timeout = this.timeoutMs;
      if (this.accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
      }

      if (options.onUploadProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            options.onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
          }
        };
      }

      if (options.signal) {
        if (options.signal.aborted) {
          xhr.abort();
          reject(new ApiClientError('ABORTED', 'Upload aborted', 0));
          return;
        }
        options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      xhr.onload = () => {
        let body: ApiResponse<{ jobId: string }> | null = null;
        try {
          body = JSON.parse(xhr.responseText) as ApiResponse<{ jobId: string }>;
        } catch {
          body = null;
        }
        if (xhr.status >= 200 && xhr.status < 300 && body?.success && body.data) {
          resolve(body.data);
        } else {
          reject(
            new ApiClientError(
              body?.error?.code ?? 'UNKNOWN_ERROR',
              body?.error?.message ?? 'Receipt upload failed',
              xhr.status,
            ),
          );
        }
      };
      xhr.onerror = () => reject(new ApiClientError('NETWORK_ERROR', 'Receipt upload failed', 0));
      xhr.ontimeout = () => reject(new ApiClientError('TIMEOUT', 'Receipt upload timed out', 0));
      xhr.onabort = () => reject(new ApiClientError('ABORTED', 'Upload aborted', 0));

      xhr.send(form);
    });
  }

  /** Add the selected parsed items (by index into the job's parsedItems) to stock. */
  confirmOcrJob(jobId: string, indices: number[]): Promise<{ added: number }> {
    return this.request<{ added: number }>(`/ocr/jobs/${jobId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ indices }),
    });
  }

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

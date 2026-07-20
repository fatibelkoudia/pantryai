import type { StockLocation } from './stock.js';

export type OcrJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CONFIRMED' | 'FAILED';

export interface OcrJob {
  id: string;
  userId: string;
  status: OcrJobStatus;
  imageKey?: string;
  retailer?: string;
  rawText?: string;
  parsedItems?: OcrParsedItem[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface OcrParsedItem {
  name: string;
  quantity?: number;
  unit?: string;
  // expiration date if the receipt had one. Used to pre-fill the review screen.
  expirationDate?: string;
  confidence: number;
}

// One item the user wants to add from a receipt. "index" says which parsed item it is.
// The other fields are only there if the user changed them in the review screen.
export interface ConfirmOcrItem {
  index: number;
  quantity?: number;
  unit?: string;
  expirationDate?: string;
  location?: StockLocation;
}

// What we send to confirm a receipt: either just the indices, or items with edits.
export interface ConfirmOcrJobPayload {
  indices?: number[];
  items?: ConfirmOcrItem[];
}

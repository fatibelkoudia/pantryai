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
  confidence: number;
}

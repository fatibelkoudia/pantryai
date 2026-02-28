export type OcrJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface OcrJob {
  id: string;
  userId: string;
  status: OcrJobStatus;
  receiptUrl?: string;
  result?: OcrResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OcrResult {
  retailer?: string;
  items: OcrLineItem[];
  total?: number;
  currency?: string;
}

export interface OcrLineItem {
  name: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  confidence: number;
}

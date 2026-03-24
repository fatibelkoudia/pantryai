export interface ParsedReceiptItem {
  name: string;
  quantity?: number;
  unit?: string;
  price?: number;
  ean13?: string;
  /**
    * DLC/DDM date read from the receipt (ex: ISO or dd/MM/yyyy).
    * If present, it pre-fills StockItem.expirationDate.
   */
  expirationDate?: string;
  confidence: number;
}

export interface ParsedReceipt {
  retailer?: string;
  items: ParsedReceiptItem[];
}

export interface ReceiptParser {
  readonly retailerName: string;
  parse(rawText: string): ParsedReceiptItem[];
}

export function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-zà-ÿ]/gu, (c) => c.toUpperCase());
}

export function parsePrice(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

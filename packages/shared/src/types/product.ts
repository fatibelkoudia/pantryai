export interface Product {
  id: string;
  name: string;
  brand?: string;
  ean13?: string;
  category?: string;
  imageUrl?: string;
  nutritionData?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  brand?: string;
  ean13?: string;
  category?: string;
  imageUrl?: string;
}

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
}

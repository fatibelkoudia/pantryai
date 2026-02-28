export interface Product {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  barcode?: string;
  category?: string;
  imageUrl?: string;
}

export interface Category {
  category_id: number;
  category_name: string;
  description: string;
}

export interface ProductImage {
  image_id: number;
  image_url: string;
  s3_key?: string;
  is_primary: boolean;
  display_order: number;
  alt_text: string;
}

export interface ProductTag {
  tag_id: number;
  tag_name: string;
}

export interface Product {
  product_id: number;
  product_name: string;
  sku: string;
  description: string;
  category_id?: number;
  category_name?: string;
  brand: string;
  base_price?: number;
  selling_price: number;
  cost_price?: number;
  tax_rate?: number;
  gst_rate?: number;
  hsn_code?: string;
  unit_of_measure?: string;
  min_stock_level?: number;
  max_stock_level?: number;
  reorder_level?: number;
  is_active?: boolean;
  is_featured?: boolean;
  total_stock?: number;
  quantity_available?: number;
  images?: ProductImage[];
  tags?: ProductTag[];
  created_at?: string;
}

export interface FormData {
  product_name: string;
  description: string;
  category_id: string;
  brand: string;
  selling_price: string;
  cost_price: string;
  gst_rate: string;
  hsn_code: string;
  stock_quantity: string;
  max_stock_level: string;
  reorder_level: string;
  is_featured: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}


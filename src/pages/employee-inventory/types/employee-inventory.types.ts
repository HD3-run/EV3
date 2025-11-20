// TypeScript interfaces for employee inventory

export interface Product {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  quantity_available: number;
  reorder_level: number;
  unit_price: number;
  created_at: string;
}


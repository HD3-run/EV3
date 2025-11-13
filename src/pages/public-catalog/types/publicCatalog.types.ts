export interface Product {
  product_id: number;
  product_name: string;
  description?: string;
  category?: string;
  category_name?: string;
  brand?: string;
  selling_price?: number;
  sku?: string;
  images?: ProductImage[];
  is_featured?: boolean;
  is_active?: boolean;
  total_stock?: number;
  quantity_available?: number;
}

export interface ProductImage {
  image_id: number;
  image_url: string;
  is_primary: boolean;
}

export interface Merchant {
  merchant_id: number;
  business_name: string;
  email?: string;
  phone_number?: string;
  address?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  alternatePhone: string;
  deliveryNote: string;
  state_code: string;
  gst_number: string;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Category {
  category_id: string;
  category_name: string;
  product_count: number;
}


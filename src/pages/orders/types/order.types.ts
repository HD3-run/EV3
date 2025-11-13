// Order-related TypeScript interfaces and types

export interface Order {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  channel: string;
  type: string;
  customer: string;
  status: string;
  amount: number;
  date: string;
  paymentStatus?: string;
  user_id?: number;
  assigned_user_name?: string;
  assigned_user_role?: string;
  order_items?: Array<{
    order_item_id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    price_per_unit: number;
    total_price: number;
    sku: string;
  }>;
}

export interface OrderFormData {
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
  isVerifiedAddress: boolean;
  deliveryNote: string;
  productName: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  orderSource: string;
  state_code: string;
  gst_number: string;
}

export interface FormErrors {
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
  productName: string;
}

export interface ReturnItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

export interface ReturnData {
  reason: string;
  returnItems: ReturnItem[];
}

export interface PaymentData {
  pricePerUnit: number;
  paymentMethod: string;
}

export interface AssignmentData {
  userId: string;
  deliveryNotes: string;
}

export interface Product {
  product_id: number;
  product_name: string;
  unit_price: number; // This is actually cost_price from the API (aliased)
  selling_price?: number; // This is the actual selling price
}

export type FilterType = 'all' | 'pending' | 'assigned' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type SortOrder = 'asc' | 'desc';


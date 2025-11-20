// Invoice-related TypeScript interfaces and types

export interface Invoice {
  invoice_id: number;
  invoice_number: number;
  invoice_prefix: string;
  display_number: string;
  order_id: number;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  discount_amount: number;
  total_amount: number;
  payment_status: 'unpaid' | 'paid' | 'partially_paid' | 'cancelled';
  payment_method?: string;
  pdf_url?: string;
  notes?: string;
  customer_name: string;
  order_status: string;
  created_at: string;
  updated_at: string;
}

export interface NewInvoiceFormData {
  orderId: string;
  dueDate: string;
  notes: string;
  discountAmount: number;
}

export interface UpdateInvoiceFormData {
  dueDate: string;
  notes: string;
  discountAmount: number;
  paymentStatus: 'unpaid' | 'paid' | 'partially_paid' | 'cancelled';
  paymentMethod: string;
}


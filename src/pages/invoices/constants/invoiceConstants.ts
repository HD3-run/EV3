// Constants for invoices

export const ITEMS_PER_PAGE = 50;

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'partially_paid', 'cancelled'] as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const FILTER_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'cancelled', label: 'Cancelled' }
] as const;


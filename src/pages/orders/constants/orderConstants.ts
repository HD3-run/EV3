// Order-related constants

export const FILTER_TYPES = ['all', 'pending', 'assigned', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
export type FilterType = typeof FILTER_TYPES[number];

export const SORT_KEYS = ['orderId', 'date', 'amount', 'status'] as const;
export type SortKey = typeof SORT_KEYS[number];

export const ORDER_STATUSES = ['pending', 'assigned', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;

export const ITEMS_PER_PAGE = 50;

export const ORDER_SOURCES = ['Manual', 'Phone', 'Email', 'Website', 'WhatsApp', 'CSV'] as const;

export const LANDMARK_MAP: { [key: string]: { city: string; state: string; country: string } } = {
  'connaught place': { city: 'New Delhi', state: 'Delhi', country: 'India' },
  'marine drive': { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  'mg road': { city: 'Bangalore', state: 'Karnataka', country: 'India' },
  'marina beach': { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  'victoria memorial': { city: 'Kolkata', state: 'West Bengal', country: 'India' },
  'sabarmati': { city: 'Ahmedabad', state: 'Gujarat', country: 'India' },
  'charminar': { city: 'Hyderabad', state: 'Telangana', country: 'India' },
  'hawa mahal': { city: 'Jaipur', state: 'Rajasthan', country: 'India' },
  'koregaon park': { city: 'Pune', state: 'Maharashtra', country: 'India' }
};


// Product-related query functions

import { getApiUrl } from '../../../config/api';
import type { Product } from '../types/order.types';

/**
 * Load products from inventory for order creation
 */
export const loadProducts = async (): Promise<Product[]> => {
  try {
    const response = await fetch(getApiUrl('/api/inventory'), {
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      console.log('📦 Loaded products for dropdown:', data.products?.length || 0, 'products');
      return data.products || [];
    } else {
      console.error('Failed to load products - response not ok:', response.status);
      return [];
    }
  } catch (error) {
    console.error('Failed to load products:', error);
    return [];
  }
};


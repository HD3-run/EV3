import { API_BASE_URL } from '../../../config/api';
import type { Category } from '../types/publicCatalog.types';

export async function fetchCategories(merchantId: string): Promise<Category[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/catalog/merchant/${merchantId}/categories`);
    const data = await response.json();
    if (data.success) {
      return data.categories;
    }
    return [];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}


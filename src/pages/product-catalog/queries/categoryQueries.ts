import { API_BASE_URL } from '../../../config/api';
import { Category } from '../types/catalog.types';

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(`${API_BASE_URL}/api/catalog/categories`, {
    credentials: 'include',
  });
  const data = await response.json();

  if (data.success) {
    return data.categories;
  }

  return [];
}


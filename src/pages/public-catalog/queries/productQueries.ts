import { API_BASE_URL } from '../../../config/api';
import type { Product, PaginationState } from '../types/publicCatalog.types';

export interface ProductFilters {
  page: number;
  limit: number;
  category?: string;
  search?: string;
}

export interface ProductQueryResponse {
  products: Product[];
  pagination: PaginationState;
}

export async function fetchProducts(
  merchantId: string,
  filters: ProductFilters
): Promise<ProductQueryResponse | null> {
  try {
    const params = new URLSearchParams({
      page: filters.page.toString(),
      limit: filters.limit.toString(),
    });

    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);

    const response = await fetch(`${API_BASE_URL}/api/public/catalog/merchant/${merchantId}/products?${params}`);
    const data = await response.json();

    if (data.success) {
      return {
        products: data.products,
        pagination: data.pagination,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching products:', error);
    return null;
  }
}


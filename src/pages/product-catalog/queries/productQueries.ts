import { API_BASE_URL } from '../../../config/api';
import { Product, Pagination } from '../types/catalog.types';

export interface FetchProductsParams {
  page: number;
  limit: number;
  category?: string;
  search?: string;
}

export async function fetchProducts(params: FetchProductsParams): Promise<{ products: Product[]; pagination: Pagination }> {
  const urlParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  if (params.category) urlParams.append('category_id', params.category);
  if (params.search) urlParams.append('search', params.search);

  const response = await fetch(`${API_BASE_URL}/api/catalog/products?${urlParams}`, {
    credentials: 'include',
  });
  const data = await response.json();

  if (data.success) {
    return {
      products: data.products,
      pagination: data.pagination,
    };
  }

  throw new Error(data.error || 'Failed to fetch products');
}

export async function fetchProduct(productId: number): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/api/catalog/products/${productId}`, {
    credentials: 'include',
  });
  const data = await response.json();

  if (data.success) {
    return data.product;
  }

  throw new Error(data.error || 'Failed to fetch product');
}


// API query functions for employee inventory products
import { Product } from '../types/employee-inventory.types';

export interface LoadProductsParams {
  page: number;
  searchTerm?: string;
  categoryFilter?: string;
  stockStatusFilter?: string;
}

export interface LoadProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function loadProducts(params: LoadProductsParams): Promise<LoadProductsResponse> {
  const { page, searchTerm, categoryFilter, stockStatusFilter } = params;
  
  // Build query parameters for server-side filtering and pagination
  const urlParams = new URLSearchParams({
    limit: '50',
    page: page.toString()
  });
  
  if (searchTerm) {
    urlParams.append('search', searchTerm);
  }
  
  if (categoryFilter && categoryFilter !== 'all') {
    urlParams.append('category', categoryFilter);
  }
  
  if (stockStatusFilter && stockStatusFilter !== 'all') {
    urlParams.append('stockStatus', stockStatusFilter);
  }
  
  const response = await fetch(`/api/inventory?${urlParams.toString()}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to load products: ${response.status} - ${errorData}`);
  }

  const data = await response.json();

  if (data.products && Array.isArray(data.products)) {
    const normalizedProducts = data.products.map((product: any): Product => ({
      product_id: product.product_id?.toString() || product.id?.toString() || '',
      product_name: product.product_name || product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      quantity_available: product.quantity_available || 0,
      reorder_level: product.reorder_level || 0,
      unit_price: product.unit_price || 0,
      created_at: product.created_at || ''
    }));

    return {
      products: normalizedProducts,
      pagination: data.pagination || {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
      }
    };
  }

  return {
    products: [],
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0
    }
  };
}


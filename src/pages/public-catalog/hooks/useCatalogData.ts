import { useState, useEffect } from 'react';
import type { Merchant, Product, Category, PaginationState } from '../types/publicCatalog.types';
import { fetchMerchant } from '../queries/merchantQueries';
import { fetchProducts, type ProductFilters } from '../queries/productQueries';
import { fetchCategories } from '../queries/categoryQueries';

export function useCatalogData(
  merchantId: string | undefined,
  filters: { searchTerm: string; selectedCategory: string; pagination: PaginationState }
) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>(filters.pagination);

  // Fetch merchant info
  useEffect(() => {
    if (merchantId) {
      fetchMerchant(merchantId).then(merchantData => {
        if (merchantData) {
          setMerchant(merchantData);
        }
      });
    }
  }, [merchantId]);

  // Fetch categories
  useEffect(() => {
    if (merchantId) {
      fetchCategories(merchantId).then(categoriesData => {
        setCategories(categoriesData);
      });
    }
  }, [merchantId]);

  // Fetch products
  useEffect(() => {
    if (merchantId) {
      setLoading(true);
      const productFilters: ProductFilters = {
        page: filters.pagination.page,
        limit: filters.pagination.limit,
        category: filters.selectedCategory || undefined,
        search: filters.searchTerm || undefined,
      };

      fetchProducts(merchantId, productFilters).then(result => {
        if (result) {
          setProducts(result.products);
          setPagination(result.pagination);
        }
        setLoading(false);
      });
    }
  }, [merchantId, filters.pagination.page, filters.selectedCategory, filters.searchTerm, filters.pagination.limit]);

  return {
    merchant,
    products,
    categories,
    loading,
    pagination,
    setPagination,
  };
}


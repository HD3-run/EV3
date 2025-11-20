import { useState, useEffect, useCallback } from 'react';
import { Product, Category, Pagination } from '../types/catalog.types';
import { fetchProducts } from '../queries/productQueries';
import { fetchCategories } from '../queries/categoryQueries';
import { fetchMerchantInfo } from '../queries/imageQueries';
import { DEFAULT_PAGE_LIMIT } from '../constants/catalogConstants';

export function useProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: DEFAULT_PAGE_LIMIT,
    total: 0,
    totalPages: 0,
  });
  const [catalogLink, setCatalogLink] = useState<string>('');

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchProducts({
        page: pagination.page,
        limit: pagination.limit,
        category: selectedCategory || undefined,
        search: searchTerm || undefined,
      });
      setProducts(result.products);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, selectedCategory, searchTerm, pagination.limit]);

  const loadCategories = useCallback(async () => {
    try {
      const categoriesData = await fetchCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  const loadMerchantInfo = useCallback(async () => {
    try {
      const link = await fetchMerchantInfo();
      if (link) {
        setCatalogLink(link);
      }
    } catch (error) {
      console.error('Error fetching merchant info:', error);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadCategories();
    loadMerchantInfo();
  }, [loadCategories, loadMerchantInfo]);

  // Removed periodic sync - WebSocket handles real-time updates
  // Only sync when tab becomes visible (in case user was away and missed WebSocket updates)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Tab became visible, syncing products (user may have missed WebSocket updates)');
        loadProducts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadProducts]);

  return {
    products,
    setProducts,
    categories,
    loading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    pagination,
    setPagination,
    catalogLink,
    setCatalogLink,
    loadProducts,
    loadCategories,
    loadMerchantInfo,
  };
}


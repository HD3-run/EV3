// Custom hook for employee inventory state management and data loading
import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types/employee-inventory.types';
import { loadProducts, LoadProductsParams } from '../queries/productQueries';
import { ITEMS_PER_PAGE } from '../constants/employee-inventoryConstants';

export function useEmployeeInventoryManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);

  const loadInventory = useCallback(async (page: number) => {
    try {
      setError(null);
      console.log('Loading inventory for employee inventory page');
      
      const params: LoadProductsParams = {
        page,
        searchTerm: searchTerm || undefined,
        categoryFilter: categoryFilter !== 'all' ? categoryFilter : undefined,
        stockStatusFilter: stockStatusFilter !== 'all' ? stockStatusFilter : undefined
      };
      
      const result = await loadProducts(params);
      setProducts(result.products);
      setTotalProducts(result.pagination.total);
      setCurrentPage(page);
      
      // Extract unique categories
      const uniqueCategories = Array.from(new Set(result.products.map((p) => p.category).filter((c) => !!c)));
      setCategories(uniqueCategories);
      
      console.log('Loaded products for employee:', result.products.length);
      console.log('Total products state set to:', result.pagination.total);
    } catch (error) {
      console.error('Failed to load employee inventory:', error);
      setError(error instanceof Error ? error.message : 'Failed to load inventory');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, stockStatusFilter]);

  useEffect(() => {
    loadInventory(1);
  }, [loadInventory]);

  useEffect(() => {
    setCurrentPage(1);
    loadInventory(1);
  }, [searchTerm, categoryFilter, stockStatusFilter, loadInventory]);

  const handlePageChange = useCallback((newPage: number) => {
    loadInventory(newPage);
  }, [loadInventory]);

  return {
    products,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    stockStatusFilter,
    setStockStatusFilter,
    currentPage,
    totalProducts,
    categories,
    loadInventory,
    handlePageChange,
    itemsPerPage: ITEMS_PER_PAGE
  };
}


import { useState } from 'react';
import type { PaginationState } from '../types/publicCatalog.types';
import { DEFAULT_PAGINATION } from '../constants/publicCatalogConstants';

export function useCatalogFilters() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION);

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number, totalPages: number) => {
    setPagination(prev => {
      // Wrap around logic: if clicking Previous on page 1, go to last page
      if (newPage < 1 && prev.page === 1) {
        return { ...prev, page: totalPages };
      }
      // Wrap around logic: if clicking Next on last page, go to first page
      if (newPage > totalPages && prev.page >= totalPages) {
        return { ...prev, page: 1 };
      }
      // Normal navigation - ensure page is within valid range
      const targetPage = Math.max(1, Math.min(newPage, totalPages));
      return { ...prev, page: targetPage };
    });
  };

  return {
    searchTerm,
    selectedCategory,
    pagination,
    setSearchTerm: handleSearchChange,
    setSelectedCategory: handleCategoryChange,
    setPagination: handlePageChange,
  };
}


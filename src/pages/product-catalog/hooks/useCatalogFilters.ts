import { useState, useCallback } from 'react';

export function useCatalogFilters() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedCategory('');
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    resetFilters,
  };
}


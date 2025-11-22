import type { PaginationState } from '../types/publicCatalog.types';
import type { Dispatch, SetStateAction } from 'react';

export interface FilterHandlers {
  onSearchChange: (searchTerm: string, setSearchTerm: (term: string) => void, setPagination: Dispatch<SetStateAction<PaginationState>>) => void;
  onCategoryChange: (category: string, setCategory: (cat: string) => void, setPagination: Dispatch<SetStateAction<PaginationState>>) => void;
  onPageChange: (page: number, setPagination: Dispatch<SetStateAction<PaginationState>>, totalPages: number) => void;
}

export const filterHandlers: FilterHandlers = {
  onSearchChange: (searchTerm, setSearchTerm, setPagination) => {
    setSearchTerm(searchTerm);
    setPagination(prev => ({ ...prev, page: 1 }));
  },

  onCategoryChange: (category, setCategory, setPagination) => {
    setCategory(category);
    setPagination(prev => ({ ...prev, page: 1 }));
  },

  onPageChange: (page, setPagination, totalPages) => {
    if (page === 1) {
      // Wrap around to last page when on first page
      setPagination(prev => ({ ...prev, page: prev.totalPages }));
    } else if (page >= totalPages) {
      // Wrap around to first page when on last page
      setPagination(prev => ({ ...prev, page: 1 }));
    } else {
      setPagination(prev => ({ ...prev, page }));
    }
  },
};


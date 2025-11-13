import type { PaginationState } from '../types/publicCatalog.types';

export interface FilterHandlers {
  onSearchChange: (searchTerm: string, setSearchTerm: (term: string) => void, setPagination: (prev: PaginationState) => PaginationState) => void;
  onCategoryChange: (category: string, setCategory: (cat: string) => void, setPagination: (prev: PaginationState) => PaginationState) => void;
  onPageChange: (page: number, setPagination: (prev: PaginationState) => PaginationState, totalPages: number) => void;
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


import React from 'react';
import { Pagination as PaginationType } from '../types/catalog.types';

interface PaginationProps {
  pagination: PaginationType;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ pagination, onPageChange }) => {
  if (pagination.totalPages <= 1) return null;

  const handlePrevious = () => {
    if (pagination.page === 1) {
      // Wrap around to last page when on first page
      onPageChange(pagination.totalPages);
    } else {
      onPageChange(pagination.page - 1);
    }
  };

  const handleNext = () => {
    if (pagination.page >= pagination.totalPages) {
      // Wrap around to first page when on last page
      onPageChange(1);
    } else {
      onPageChange(pagination.page + 1);
    }
  };

  return (
    <div className="flex justify-center items-center gap-2 mt-6">
      <button
        onClick={handlePrevious}
        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Previous
      </button>
      <span className="text-gray-700 dark:text-gray-300">
        Page {pagination.page} of <button
          onClick={() => onPageChange(pagination.totalPages)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium cursor-pointer"
          title="Go to last page"
        >
          {pagination.totalPages}
        </button>
      </span>
      <button
        onClick={handleNext}
        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Next
      </button>
    </div>
  );
};


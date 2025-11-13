// Pagination component

import { ITEMS_PER_PAGE } from '../constants/orderConstants';

interface PaginationProps {
  currentPage: number;
  totalOrders: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalOrders,
  onPageChange
}: PaginationProps) {
  const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

  if (totalOrders <= ITEMS_PER_PAGE) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage === 1) {
      // Wrap around to last page when on first page
      onPageChange(totalPages);
    } else {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage >= totalPages) {
      // Wrap around to first page when on last page
      onPageChange(1);
    } else {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex justify-center items-center gap-3 mt-8">
      <button
        onClick={handlePrevious}
        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
      >
        Previous
      </button>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={handleNext}
        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
      >
        Next
      </button>
    </div>
  );
}


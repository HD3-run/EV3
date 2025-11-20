// Pagination Component for Employee Inventory
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, totalProducts, itemsPerPage, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
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
    <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalProducts)} of {totalProducts} results
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handlePrevious}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Previous
        </button>
        <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
          Page {currentPage} of <button
            onClick={() => onPageChange(totalPages)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium cursor-pointer"
            title="Go to last page"
          >
            {totalPages}
          </button>
        </span>
        <button
          onClick={handleNext}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Next
        </button>
      </div>
    </div>
  );
}


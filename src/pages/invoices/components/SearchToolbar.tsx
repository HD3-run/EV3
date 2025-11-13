// Search and filter toolbar component for invoices

import { FILTER_STATUS_OPTIONS } from '../constants/invoiceConstants';

interface SearchToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onFilterChange: (value: string) => void;
}

export default function SearchToolbar({
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterChange
}: SearchToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
      <input
        type="text"
        placeholder="Search by customer name..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full sm:w-1/3 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      />
      <select
        value={filterStatus}
        onChange={(e) => onFilterChange(e.target.value)}
        className="w-full sm:w-1/4 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        {FILTER_STATUS_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}


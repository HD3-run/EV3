// Search and filter toolbar component

import FileUpload from '../../../components/FileUpload';
import DownloadDropdown from '../../../components/DownloadDropdown';
import type { Order } from '../types/order.types';

interface SearchToolbarProps {
  searchTerm: string;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  filterType: string;
  onFilterChange: (value: string) => void;
  sortKey: keyof Order;
  onSortKeyChange: (value: keyof Order) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderToggle: () => void;
  onAddOrderClick: () => void;
  onFileUpload: (file: File) => Promise<void>;
  currentUploadId: string | null;
  onProcessingErrors: (errors: string[]) => void;
  onDownloadCSV: () => void;
  onDownloadExcel: () => void;
  onDownloadPDF: () => void;
  processingErrorsCount: number;
  onErrorsClick: () => void;
  userRole: string;
}

export default function SearchToolbar({
  searchTerm,
  searchInputRef,
  onSearchChange,
  onSearchKeyDown,
  filterType,
  onFilterChange,
  sortKey,
  onSortKeyChange,
  sortOrder,
  onSortOrderToggle,
  onAddOrderClick,
  onFileUpload,
  currentUploadId,
  onProcessingErrors,
  onDownloadCSV,
  onDownloadExcel,
  onDownloadPDF,
  processingErrorsCount,
  onErrorsClick,
  userRole
}: SearchToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Search by customer name, customer ID, or order ID..."
        className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg w-full sm:w-[31rem] bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={onSearchKeyDown}
      />
      
      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Filter by Status
        </label>
        <select
          value={filterType}
          onChange={(e) => onFilterChange(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
          <option value="all">All Orders</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="confirmed">Confirmed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Filter by Order Specifics
        </label>
        <select
          value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value as keyof Order)}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
          <option value="orderId">Sort by ID</option>
          <option value="date">Sort by Date</option>
          <option value="amount">Sort by Amount</option>
          <option value="paymentStatus">Sort by Payment Status</option>
        </select>
      </div>

      <div className="flex flex-col">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Sort Order
        </label>
        <button
          onClick={onSortOrderToggle}
          className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
          title={sortOrder === 'asc' ? 'Ascending (Click to change to Descending)' : 'Descending (Click to change to Ascending)'}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {userRole === 'admin' && (
        <>
          <button
            onClick={onAddOrderClick}
            className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
          >
            Add Order
          </button>

          <FileUpload 
            onFileUpload={onFileUpload} 
            buttonLabel="Upload CSV" 
            showProgress={true} 
            uploadId={currentUploadId || undefined}
            onProcessingErrors={onProcessingErrors}
          />

          <DownloadDropdown
            onDownloadCSV={onDownloadCSV}
            onDownloadExcel={onDownloadExcel}
            onDownloadPDF={onDownloadPDF}
          />

          {processingErrorsCount > 0 && (
            <button
              onClick={onErrorsClick}
              className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors relative"
            >
              Errors ({processingErrorsCount})
            </button>
          )}
        </>
      )}
    </div>
  );
}


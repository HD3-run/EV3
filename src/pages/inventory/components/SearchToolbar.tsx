// Search and Filter Toolbar Component
import FileUpload from '../../../components/FileUpload';
import DownloadDropdown from '../../../components/DownloadDropdown';

interface SearchToolbarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    categoryFilter: string;
    setCategoryFilter: (filter: string) => void;
    stockStatusFilter: string;
    setStockStatusFilter: (filter: string) => void;
    categories: string[];
    processingErrors: string[];
    setShowErrorsModal: (show: boolean) => void;
    handleFileUpload: (file: File) => Promise<void>;
    handleCSVUpload: (file: File) => Promise<void>;
    handleDownloadCSV: () => void;
    handleDownloadExcel: () => void;
    handleDownloadPDF: () => void;
    currentUploadId: string | null;
}

export function SearchToolbar({
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    stockStatusFilter,
    setStockStatusFilter,
    categories,
    processingErrors,
    setShowErrorsModal,
    handleCSVUpload,
    handleDownloadCSV,
    handleDownloadExcel,
    handleDownloadPDF,
    currentUploadId
}: SearchToolbarProps) {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-4">
                <DownloadDropdown
                    onDownloadCSV={handleDownloadCSV}
                    onDownloadExcel={handleDownloadExcel}
                    onDownloadPDF={handleDownloadPDF}
                />
                {processingErrors.length > 0 && (
                    <button
                        onClick={() => setShowErrorsModal(true)}
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center space-x-2"
                        title="View processing errors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span>Processing Errors ({processingErrors.length})</span>
                    </button>
                )}
                <input
                    type="text"
                    placeholder="Search by product name, SKU, or ID (e.g., 1049110)"
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-full sm:w-80"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    <option value="all">All Categories</option>
                    {categories.map((category, index) => (
                        <option key={category || `category-${index}`} value={category}>{category}</option>
                    ))}
                </select>
                <select
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={stockStatusFilter}
                    onChange={(e) => setStockStatusFilter(e.target.value)}
                >
                    <option value="all">All Stock</option>
                    <option value="in">In Stock</option>
                    <option value="low">Low Stock</option>
                </select>
            </div>
            <div className="flex items-center space-x-4">
                <FileUpload 
                    buttonLabel="Update Stock by CSV" 
                    onFileUpload={handleCSVUpload} 
                    showProgress={true}
                    uploadId={currentUploadId || undefined}
                />
                <div className="relative group flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info text-gray-400 dark:text-gray-500 cursor-pointer">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                    </svg>
                    <div className="absolute bottom-full right-0 mr-4 mb-2 hidden group-hover:block w-80 p-3 bg-gray-800 text-white text-sm rounded-md shadow-lg z-10">
                        <p className="mb-1">Your CSV file should include these columns:</p>
                        <p className="font-mono">product_name, sku, stock</p>
                        <p className="mt-2"><strong>Example:</strong> Router, RT100, 50</p>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-800 rotate-45"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}


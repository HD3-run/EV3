// Employee Inventory Page - Modularized
import { useEmployeeInventoryManagement } from './employee-inventory/hooks/useEmployeeInventoryManagement';
import { useEmployeeInventoryFilters } from './employee-inventory/hooks/useEmployeeInventoryFilters';
import { MetricsCards } from './employee-inventory/components/MetricsCards';
import { SearchToolbar } from './employee-inventory/components/SearchToolbar';
import { ProductsTable } from './employee-inventory/components/ProductsTable';
import { Pagination } from './employee-inventory/components/Pagination';

export default function EmployeeInventory() {
  // Use custom hooks for state management
  const {
    products,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    stockStatusFilter,
    setStockStatusFilter,
    currentPage,
    totalProducts,
    categories,
    loadInventory,
    handlePageChange,
    itemsPerPage
  } = useEmployeeInventoryManagement();

  // Use filter hook for calculated values
  const { lowStockProducts, outOfStockProducts } = useEmployeeInventoryFilters(products);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Inventory</h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-gray-600 dark:text-gray-400">Loading inventory...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalProducts / itemsPerPage);

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Inventory</h1>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex justify-between items-center">
            <div>
              <strong className="font-bold">Error Loading Inventory:</strong>
              <span className="block sm:inline ml-2">{error}</span>
            </div>
            <button 
              onClick={() => loadInventory(currentPage)}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <MetricsCards
        totalProducts={totalProducts}
        lowStockProducts={lowStockProducts}
        outOfStockProducts={outOfStockProducts}
      />

      {/* Search and Filter */}
      <SearchToolbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        stockStatusFilter={stockStatusFilter}
        setStockStatusFilter={setStockStatusFilter}
        categories={categories}
      />

      {/* Products Table */}
      <ProductsTable products={products} />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalProducts={totalProducts}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
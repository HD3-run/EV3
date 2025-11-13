// Search and Filter Toolbar Component for Employee Inventory
interface SearchToolbarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  stockStatusFilter: string;
  setStockStatusFilter: (filter: string) => void;
  categories: string[];
}

export function SearchToolbar({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  stockStatusFilter,
  setStockStatusFilter,
  categories
}: SearchToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4">
      <input
        type="text"
        placeholder="Search by product name or SKU..."
        className="p-2 border border-gray-300 dark:border-gray-700 rounded-md w-full sm:w-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <select
        className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
      >
        <option value="all">All Categories</option>
        {categories.map(category => (
          <option key={category} value={category}>{category}</option>
        ))}
      </select>
      <select
        className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        value={stockStatusFilter}
        onChange={(e) => setStockStatusFilter(e.target.value)}
      >
        <option value="all">All Stock</option>
        <option value="in">In Stock</option>
        <option value="low">Low Stock</option>
      </select>
    </div>
  );
}


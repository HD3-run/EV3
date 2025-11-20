// Metrics Cards Component for Employee Inventory
interface MetricsCardsProps {
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

export function MetricsCards({ totalProducts, lowStockProducts, outOfStockProducts }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Total Products</h3>
        <p className="text-3xl font-bold text-blue-600">{totalProducts}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Low Stock</h3>
        <p className="text-3xl font-bold text-yellow-600">{lowStockProducts}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Out of Stock</h3>
        <p className="text-3xl font-bold text-red-600">{outOfStockProducts}</p>
      </div>
    </div>
  );
}


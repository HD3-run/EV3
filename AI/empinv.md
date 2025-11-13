import { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/currency';
import { getApiUrl } from '../config/api';

interface Product {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  quantity_available: number;
  reorder_level: number;
  unit_price: number;
  created_at: string;
}

export default function EmployeeInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const itemsPerPage = 50; // 50 items per page like admin inventory

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    loadInventory(1);
  }, [searchTerm, categoryFilter, stockStatusFilter]);

  const loadInventory = async (page: number = currentPage) => {
    try {
      setError(null);
      console.log('Loading inventory for employee inventory page');
      
      // Build query parameters for server-side filtering and pagination
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        page: page.toString()
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      if (categoryFilter && categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      
      if (stockStatusFilter && stockStatusFilter !== 'all') {
        params.append('stockStatus', stockStatusFilter);
      }
      
      const response = await fetch(getApiUrl(`/api/inventory?${params.toString()}`), {
        credentials: 'include'
      });
      
      console.log('Employee inventory API response:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error in EmployeeInventory:', response.status, errorData);
        setError(`Failed to load inventory: ${response.status} - ${errorData}`);
        setProducts([]);
        return;
      }
      
      const data = await response.json();
      console.log('Employee inventory data:', data);
      console.log('Pagination data:', data.pagination);
      console.log('Total products from pagination:', data.pagination?.total);
      
      if (data.products && Array.isArray(data.products)) {
        const productsData = data.products as Product[];
        setProducts(productsData);
        
        // Update total count from pagination data
        if (data.pagination && data.pagination.total) {
          setTotalProducts(data.pagination.total);
        } else {
          // Fallback: if no pagination data, use the actual products length
          setTotalProducts(productsData.length);
        }
        
        console.log('Loaded products for employee:', data.products.length);
        console.log('Total products state set to:', data.pagination?.total || productsData.length);
        
        // Extract unique categories
        const uniqueCategories = Array.from(new Set(productsData.map((p) => p.category).filter((c) => !!c)));
        setCategories(uniqueCategories);
      } else {
        console.warn('No products array in employee inventory response:', data);
        setProducts([]);
        if (data.debug) {
          console.log('Debug info from employee inventory API:', data.debug);
        }
      }
    } catch (error) {
      console.error('Failed to load employee inventory:', error);
      setError(error instanceof Error ? error.message : 'Failed to load inventory');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    
    const matchesStockStatus = stockStatusFilter === 'all' || 
      (stockStatusFilter === 'low' && product.quantity_available <= product.reorder_level) ||
      (stockStatusFilter === 'in' && product.quantity_available > product.reorder_level);

    return matchesSearch && matchesCategory && matchesStockStatus;
  });

  const lowStockProducts = products.filter(p => p.quantity_available <= p.reorder_level).length;
  const outOfStockProducts = products.filter(p => p.quantity_available === 0).length;

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
              onClick={() => { setError(null); loadInventory(); }}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
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

      {/* Search and Filter */}
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

      {/* Products Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Product Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SKU</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Category</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stock</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reorder Level</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unit Price</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No products found.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
              <tr key={product.product_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{product.product_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{product.sku}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{product.category || 'Uncategorized'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{product.quantity_available}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{product.reorder_level}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(product.unit_price)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    product.quantity_available === 0 ? 'bg-red-100 text-red-800' :
                    product.quantity_available <= product.reorder_level ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {product.quantity_available === 0 ? 'Out of Stock' :
                     product.quantity_available <= product.reorder_level ? 'Low Stock' :
                     'In Stock'}
                  </span>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {Math.ceil(totalProducts / itemsPerPage) > 1 && (() => {
        const totalPages = Math.ceil(totalProducts / itemsPerPage);
        const handlePrevious = () => {
          if (currentPage === 1) {
            // Wrap around to last page when on first page
            const newPage = totalPages;
            setCurrentPage(newPage);
            loadInventory(newPage);
          } else {
            const newPage = currentPage - 1;
            setCurrentPage(newPage);
            loadInventory(newPage);
          }
        };
        const handleNext = () => {
          if (currentPage >= totalPages) {
            // Wrap around to first page when on last page
            const newPage = 1;
            setCurrentPage(newPage);
            loadInventory(newPage);
          } else {
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            loadInventory(newPage);
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
                  onClick={() => {
                    setCurrentPage(totalPages);
                    loadInventory(totalPages);
                  }}
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
      })()}
    </div>
  );
}
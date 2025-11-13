// Products Table Component
import { Product, EditingPrice, ManualUpdateProduct } from '../types/inventory.types';
import { ProductRow } from './ProductRow';
import { Pagination } from './Pagination';
import { formatCurrency } from '../../../utils/currency';

interface ProductsTableProps {
    products: Product[];
    userRole: string;
    editingPrice: EditingPrice | null;
    setEditingPrice: (price: EditingPrice | null) => void;
    handlePriceEdit: (productId: number, currentPrice: number, priceType?: 'cost' | 'selling') => void;
    handlePriceSave: (productId: number) => void;
    handlePriceCancel: () => void;
    setManualUpdateProduct: (product: ManualUpdateProduct) => void;
    setShowManualUpdateModal: (show: boolean) => void;
    expandedProducts: Set<number>;
    toggleProductExpansion: (productId: number) => void;
    currentPage: number;
    totalPages: number;
    totalProducts: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    loading?: boolean;
}

export function ProductsTable({
    products,
    userRole,
    editingPrice,
    setEditingPrice,
    handlePriceEdit,
    handlePriceSave,
    handlePriceCancel,
    setManualUpdateProduct,
    setShowManualUpdateModal,
    expandedProducts,
    toggleProductExpansion,
    currentPage,
    totalPages,
    totalProducts,
    itemsPerPage,
    onPageChange,
    loading = false
}: ProductsTableProps) {
    if (products.length === 0 && !loading) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No products found. {products.length === 0 ? 'Add some products to get started.' : 'Try adjusting your search or filters.'}
            </div>
        );
    }

    return (
        <>
            {loading && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    Loading products...
                </div>
            )}
            {/* Desktop Table View */}
            <div className="hidden lg:block">
                <div className={`overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">Product Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/6">Category</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/6">Cost Price</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/6">Selling Price</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">Stock</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">View More</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/12">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {products.map((product, index) => (
                                <ProductRow
                                    key={product.product_id || `product-${index}`}
                                    product={product}
                                    userRole={userRole}
                                    editingPrice={editingPrice}
                                    setEditingPrice={setEditingPrice}
                                    handlePriceEdit={handlePriceEdit}
                                    handlePriceSave={handlePriceSave}
                                    handlePriceCancel={handlePriceCancel}
                                    setManualUpdateProduct={setManualUpdateProduct}
                                    setShowManualUpdateModal={setShowManualUpdateModal}
                                    expandedProducts={expandedProducts}
                                    toggleProductExpansion={toggleProductExpansion}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalProducts={totalProducts}
                        itemsPerPage={itemsPerPage}
                        onPageChange={onPageChange}
                    />
                )}
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden">
                <div style={{ height: '70vh', overflow: 'auto' }} className={`grid gap-4 p-4 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {products.map((product, index) => (
                        <div 
                            key={product.product_id || `product-${index}`}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
                        >
                            {/* Product Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {product.product_name}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {product.category || 'Uncategorized'}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${product.is_low_stock ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                                    {product.is_low_stock ? 'Low Stock' : 'In Stock'}
                                </span>
                            </div>

                            {/* Product Details Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cost Price</p>
                                    {userRole === 'admin' ? (
                                        editingPrice?.productId === product.product_id && editingPrice?.priceType === 'cost' ? (
                                            <div className="flex items-center space-x-1">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={editingPrice?.value || ''}
                                                    onChange={(e) => setEditingPrice({...editingPrice!, value: e.target.value})}
                                                    className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handlePriceSave(product.product_id)}
                                                    className="text-green-600 hover:text-green-800 text-xs"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={handlePriceCancel}
                                                    className="text-red-600 hover:text-red-800 text-xs"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                                                    {product.unit_price && product.unit_price > 0 ? formatCurrency(product.unit_price) : 'Not set'}
                                                </p>
                                                <button
                                                    onClick={() => handlePriceEdit(product.product_id, Number(product.unit_price || 0), 'cost')}
                                                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                                >
                                                    ✏️
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                                            {product.unit_price && product.unit_price > 0 ? formatCurrency(product.unit_price) : 'Not set'}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Selling Price</p>
                                    {userRole === 'admin' ? (
                                        editingPrice?.productId === product.product_id && editingPrice?.priceType === 'selling' ? (
                                            <div className="flex items-center space-x-1">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={editingPrice?.value || ''}
                                                    onChange={(e) => setEditingPrice({...editingPrice!, value: e.target.value})}
                                                    className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handlePriceSave(product.product_id)}
                                                    className="text-green-600 hover:text-green-800 text-xs"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={handlePriceCancel}
                                                    className="text-red-600 hover:text-red-800 text-xs"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                                                    {product.selling_price && product.selling_price > 0 ? formatCurrency(product.selling_price) : 'Not set'}
                                                </p>
                                                <button
                                                    onClick={() => handlePriceEdit(product.product_id, Number(product.selling_price || 0), 'selling')}
                                                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                                >
                                                    ✏️
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                                            {product.selling_price && product.selling_price > 0 ? formatCurrency(product.selling_price) : 'Not set'}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stock</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                                        {product.quantity_available || 0}
                                    </p>
                                </div>
                            </div>

                            {/* View More Button */}
                            <div className="mb-3">
                                <button
                                    onClick={() => toggleProductExpansion(product.product_id)}
                                    className="w-full px-4 py-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm font-medium rounded border border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                                >
                                    {expandedProducts.has(product.product_id) ? 'View Less' : 'View More'}
                                </button>
                            </div>

                            {/* Expanded Details */}
                            {expandedProducts.has(product.product_id) && (
                                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Product ID</p>
                                            <p className="text-sm text-gray-900 dark:text-white font-mono">
                                                {product.product_id}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">SKU</p>
                                            <p className="text-sm text-gray-900 dark:text-white font-mono">
                                                {product.sku}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Merchant ID</p>
                                            <p className="text-sm text-gray-900 dark:text-white font-mono">
                                                {product.merchant_id}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Brand</p>
                                            <p className="text-sm text-gray-900 dark:text-white">
                                                {product.brand || 'Not specified'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reorder Level</p>
                                            <p className="text-sm text-gray-900 dark:text-white font-mono">
                                                {product.reorder_level || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
                                            <p className="text-sm text-gray-900 dark:text-white">
                                                {product.description || 'No description available'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            {userRole === 'admin' && (
                                <button
                                    onClick={() => {
                                        const gstRate = product.gst_rate !== undefined && product.gst_rate !== null 
                                            ? (typeof product.gst_rate === 'string' ? parseFloat(product.gst_rate) : product.gst_rate)
                                            : 18;
                                        setManualUpdateProduct({
                                            productId: product.product_id,
                                            productName: product.product_name,
                                            sku: product.sku,
                                            brand: product.brand || '',
                                            description: product.description || '',
                                            stock: product.quantity_available || 0,
                                            reorderLevel: product.reorder_level || 0,
                                            hsn_code: product.hsn_code || '',
                                            gst_rate: gstRate
                                        });
                                        setShowManualUpdateModal(true);
                                    }}
                                    className="w-full mt-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                                >
                                    Update Product
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                
                {totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalProducts={totalProducts}
                        itemsPerPage={itemsPerPage}
                        onPageChange={onPageChange}
                        isMobile={true}
                    />
                )}
            </div>
        </>
    );
}


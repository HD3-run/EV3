// Product Row Component
import { memo } from 'react';
import { formatCurrency } from '../../../utils/currency';
import { Product, EditingPrice, ManualUpdateProduct } from '../types/inventory.types';

interface ProductRowProps {
    product: Product;
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
}

export const ProductRow = memo(({
    product,
    userRole,
    editingPrice,
    setEditingPrice,
    handlePriceEdit,
    handlePriceSave,
    handlePriceCancel,
    setManualUpdateProduct,
    setShowManualUpdateModal,
    expandedProducts,
    toggleProductExpansion
}: ProductRowProps) => {
    return (
        <>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                {/* Product Name - Left aligned */}
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    <div className="max-w-xs truncate" title={product.product_name}>
                        {product.product_name}
                    </div>
                </td>
                
                {/* Category - Left aligned */}
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    <div className="max-w-xs truncate" title={product.category || 'Uncategorized'}>
                        {product.category || 'Uncategorized'}
                    </div>
                </td>
                
                {/* Cost Price - Right aligned */}
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                    {userRole === 'admin' ? (
                        editingPrice?.productId === product.product_id && editingPrice?.priceType === 'cost' ? (
                            <div className="flex items-center justify-end space-x-2">
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
                            <div className="flex items-center justify-end space-x-2">
                                <span className="font-mono">
                                    {product.unit_price && product.unit_price > 0 ? formatCurrency(product.unit_price) :
                                     <span className="text-gray-400 italic">Not set</span>}
                                </span>
                                <button
                                    onClick={() => handlePriceEdit(product.product_id, product.unit_price || 0, 'cost')}
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                    title="Edit cost price"
                                >
                                    ✏️
                                </button>
                            </div>
                        )
                    ) : (
                        <span className="font-mono">
                            {product.unit_price && product.unit_price > 0 ? formatCurrency(product.unit_price) :
                             <span className="text-gray-400 italic">Not set</span>}
                        </span>
                    )}
                </td>
                
                {/* Selling Price - Right aligned */}
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                    {userRole === 'admin' ? (
                        editingPrice?.productId === product.product_id && editingPrice?.priceType === 'selling' ? (
                            <div className="flex items-center justify-end space-x-2">
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
                            <div className="flex items-center justify-end space-x-2">
                                <span className="font-mono">
                                    {product.selling_price && product.selling_price > 0 ? formatCurrency(product.selling_price) :
                                     <span className="text-gray-400 italic">Not set</span>}
                                </span>
                                <button
                                    onClick={() => handlePriceEdit(product.product_id, product.selling_price || 0, 'selling')}
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                    title="Edit selling price"
                                >
                                    ✏️
                                </button>
                            </div>
                        )
                    ) : (
                        <span className="font-mono">
                            {product.selling_price && product.selling_price > 0 ? formatCurrency(product.selling_price) :
                             <span className="text-gray-400 italic">Not set</span>}
                        </span>
                    )}
                </td>
                
                {/* Stock - Right aligned */}
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                    <span className="font-mono font-medium">
                        {product.quantity_available || 0}
                    </span>
                </td>
                
                {/* Status - Center aligned */}
                <td className="px-6 py-4 text-sm text-center">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        product.is_low_stock 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                        {product.is_low_stock ? 'Low Stock' : 'In Stock'}
                    </span>
                </td>
                
                {/* View More - Center aligned */}
                <td className="px-6 py-4 text-sm text-center">
                    <button
                        onClick={() => toggleProductExpansion(product.product_id)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm font-medium px-3 py-1 rounded border border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                    >
                        {expandedProducts.has(product.product_id) ? 'View Less' : 'View More'}
                    </button>
                </td>
                
                {/* Actions - Center aligned */}
                <td className="px-6 py-4 text-sm text-center">
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
                            className="text-indigo-600 hover:text-indigo-900 text-xs font-medium px-3 py-1 rounded border border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors"
                        >
                            Update
                        </button>
                    )}
                </td>
            </tr>
            
            {/* Expanded Details Row */}
            {expandedProducts.has(product.product_id) && (
                <tr className="bg-gray-50 dark:bg-gray-700 relative z-10">
                    <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Product ID */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product ID</label>
                                <div className="text-sm text-gray-900 dark:text-white font-mono">
                                    {product.product_id}
                                </div>
                            </div>

                            {/* SKU */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">SKU</label>
                                <div className="text-sm text-gray-900 dark:text-white font-mono">
                                    {product.sku}
                                </div>
                            </div>

                            {/* Merchant ID */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Merchant ID</label>
                                <div className="text-sm text-gray-900 dark:text-white font-mono">
                                    {product.merchant_id}
                                </div>
                            </div>

                            {/* Product Name */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product Name</label>
                                <div className="text-sm text-gray-900 dark:text-white">
                                    {product.product_name}
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
                                <div className="text-sm text-gray-900 dark:text-white">
                                    {product.category || 'Uncategorized'}
                                </div>
                            </div>

                            {/* Brand */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Brand</label>
                                <div className="text-sm text-gray-900 dark:text-white">
                                    {product.brand || 'Not specified'}
                                </div>
                            </div>

                            {/* Reorder Level */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Reorder Level</label>
                                <div className="text-sm text-gray-900 dark:text-white font-mono">
                                    {product.reorder_level || 0}
                                </div>
                            </div>

                            {/* HSN Code */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">HSN Code</label>
                                <div className="text-sm text-gray-900 dark:text-white font-mono">
                                    {product.hsn_code || 'Not set'}
                                </div>
                            </div>

                            {/* GST Rate */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">GST Rate</label>
                                <div className="text-sm text-gray-900 dark:text-white">
                                    {product.gst_rate ? `${product.gst_rate}%` : 'Not set'}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="md:col-span-2 lg:col-span-3">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                                <div className="text-sm text-gray-900 dark:text-white">
                                    {product.description || 'No description available'}
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
});

ProductRow.displayName = 'ProductRow';


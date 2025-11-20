import React from 'react';
import { Edit, Trash2, Eye, Image as ImageIcon } from 'lucide-react';
import { Product } from '../types/catalog.types';
import { getPrimaryImageUrl } from '../utils/imageUtils';

interface ProductCardProps {
  product: Product;
  onView: (productId: number) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onView, onEdit, onDelete }) => {
  const primaryImageUrl = getPrimaryImageUrl(product.images);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
      {/* Product Image */}
      <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
        {primaryImageUrl ? (
          <img
            src={primaryImageUrl}
            alt={product.product_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon size={48} className="text-gray-400" />
          </div>
        )}
        
        {/* Featured Badge */}
        {product.is_featured && (
          <span className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-1 rounded-full font-semibold">
            Featured
          </span>
        )}

        {/* Stock Badge */}
        <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-full font-semibold ${
          (product.total_stock || product.quantity_available || 0) > (product.reorder_level || 0)
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          Stock: {product.total_stock || product.quantity_available || 0}
        </span>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1 truncate">
          {product.product_name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          SKU: {product.sku}
        </p>
        
        {product.category_name && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
            {product.category_name}
          </p>
        )}

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {product.tags.slice(0, 3).map(tag => (
              <span
                key={tag.tag_id}
                className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full"
              >
                {tag.tag_name}
              </span>
            ))}
          </div>
        )}

        {/* Pricing */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              ₹{Number(product.selling_price || 0).toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-500">+ {product.gst_rate || product.tax_rate || 0}% GST</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onView(product.product_id)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
          >
            <Eye size={16} />
            View
          </button>
          <button
            onClick={() => onEdit(product)}
            className="flex items-center justify-center p-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(product.product_id)}
            className="flex items-center justify-center p-2 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};


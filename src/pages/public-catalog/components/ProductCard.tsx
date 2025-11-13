import React from 'react';
import type { Product } from '../types/publicCatalog.types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, onViewDetails }) => {
  const isOutOfStock = !product.total_stock || product.total_stock === 0;

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails(product);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div 
        onClick={handleCardClick}
        className="cursor-pointer"
      >
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0].image_url}
            alt={product.product_name}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-gray-400">No Image</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 
          onClick={handleCardClick}
          className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {product.product_name}
        </h3>
        {product.category && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{product.category}</p>
        )}
        <div className="flex justify-between items-center mb-3">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            ₹{(Number(product.selling_price) || 0).toFixed(2)}
          </span>
          {product.total_stock !== undefined && (
            <span className={`text-xs px-2 py-1 rounded ${
              !isOutOfStock
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {!isOutOfStock ? 'In Stock' : 'Out of Stock'}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          disabled={isOutOfStock}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
};


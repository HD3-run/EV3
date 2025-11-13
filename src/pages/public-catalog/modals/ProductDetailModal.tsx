import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../types/publicCatalog.types';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!isOpen || !product) return null;

  const images = product.images || [];
  const primaryImage = images.find(img => img.is_primary) || images[0];
  const otherImages = images.filter(img => !img.is_primary);
  const allImages = primaryImage ? [primaryImage, ...otherImages] : images;

  const isOutOfStock = !product.total_stock || product.total_stock === 0;

  const handlePreviousImage = () => {
    setSelectedImageIndex(prev => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNextImage = () => {
    setSelectedImageIndex(prev => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const currentImage = allImages[selectedImageIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {product.product_name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Gallery */}
            <div className="space-y-4">
              {/* Main Image */}
              <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                {currentImage ? (
                  <img
                    src={currentImage.image_url}
                    alt={product.product_name}
                    className="w-full h-96 object-contain"
                  />
                ) : (
                  <div className="w-full h-96 flex items-center justify-center">
                    <span className="text-gray-400">No Image</span>
                  </div>
                )}

                {/* Navigation Arrows (only show if more than 1 image) */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={handlePreviousImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-opacity"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-opacity"
                      aria-label="Next image"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}

                {/* Image Counter */}
                {allImages.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white text-sm px-3 py-1 rounded-full">
                    {selectedImageIndex + 1} / {allImages.length}
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              {allImages.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {allImages.map((image, index) => (
                    <button
                      key={image.image_id}
                      onClick={() => handleImageClick(index)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImageIndex === index
                          ? 'border-blue-600 dark:border-blue-400'
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <img
                        src={image.image_url}
                        alt={`${product.product_name} - Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {image.is_primary && (
                        <span className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-4">
              {/* Price and Stock */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ₹{(Number(product.selling_price) || 0).toFixed(2)}
                  </p>
                  {product.category && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {product.category}
                    </p>
                  )}
                </div>
                {product.total_stock !== undefined && (
                  <span className={`text-sm px-3 py-1 rounded-full font-semibold ${
                    !isOutOfStock
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {!isOutOfStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Description
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Additional Info */}
              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {product.category && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Category:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{product.category}</span>
                  </div>
                )}
                {product.brand && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Brand:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{product.brand}</span>
                  </div>
                )}
                {product.total_stock !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Stock Available:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{product.total_stock}</span>
                  </div>
                )}
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={() => {
                  onAddToCart(product);
                  onClose();
                }}
                disabled={isOutOfStock}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
              >
                {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


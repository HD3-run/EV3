import React from 'react';
import { Upload, Star, Trash2, Image as ImageIcon } from 'lucide-react';
import { Product } from '../types/catalog.types';

interface ImageGalleryProps {
  product: Product;
  uploading: boolean;
  onUpload: (file: File) => void;
  onSetPrimary: (imageId: number) => void;
  onDelete: (imageId: number) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  product,
  uploading,
  onUpload,
  onSetPrimary,
  onDelete,
}) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Product Images</h3>
        <label className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload Image'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUpload(file);
              }
            }}
          />
        </label>
      </div>

      {product.images && product.images.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {product.images.map(image => (
            <div key={image.image_id} className="relative group">
              <img
                src={image.image_url}
                alt={image.alt_text || product.product_name}
                className="w-full h-40 object-cover rounded-lg"
              />
              {image.is_primary && (
                <span className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Primary
                </span>
              )}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!image.is_primary && (
                  <button
                    onClick={() => onSetPrimary(image.image_id)}
                    className="p-1 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                    title="Set as Primary"
                  >
                    <Star size={16} />
                  </button>
                )}
                <button
                  onClick={() => onDelete(image.image_id)}
                  className="p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                  title="Delete Image"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <ImageIcon size={48} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-600 dark:text-gray-400">No images uploaded</p>
        </div>
      )}
    </div>
  );
};


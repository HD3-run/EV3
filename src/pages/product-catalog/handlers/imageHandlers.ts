import { useAuthFetch } from '../../../hooks/useAuthFetch';
import { API_BASE_URL } from '../../../config/api';
import { Product } from '../types/catalog.types';
import { fetchProduct } from '../queries/productQueries';

export interface ImageHandlers {
  handleImageUpload: (
    productId: number,
    file: File,
    isPrimary: boolean,
    isFeatured: boolean,
    onSuccess: () => void,
    onProductUpdate?: (product: Product) => void
  ) => Promise<void>;
  handleDeleteImage: (
    productId: number,
    imageId: number,
    onSuccess: () => void,
    onProductUpdate?: (product: Product) => void
  ) => Promise<void>;
  handleSetPrimaryImage: (
    productId: number,
    catalogueId: number,
    onSuccess: () => void,
    onProductUpdate?: (product: Product) => void
  ) => Promise<void>;
}

export function useImageHandlers(authFetch: ReturnType<typeof useAuthFetch>) {
  const handleImageUpload = async (
    productId: number,
    file: File,
    isPrimary: boolean,
    isFeatured: boolean,
    onSuccess: () => void,
    onProductUpdate?: (product: Product) => void
  ) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('is_primary', isPrimary.toString());
      formData.append('is_featured', isFeatured.toString());
      formData.append('alt_text', file.name);

      const response = await authFetch(`${API_BASE_URL}/api/catalog/products/${productId}/images`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
        if (onProductUpdate) {
          const updatedProduct = await fetchProduct(productId);
          onProductUpdate(updatedProduct);
        }
      } else {
        alert(data.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    }
  };

  const handleDeleteImage = async (
    productId: number,
    imageId: number,
    onSuccess: () => void,
    onProductUpdate?: (product: Product) => void
  ) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/catalog/products/${productId}/images/${imageId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        onSuccess();
        if (onProductUpdate) {
          const updatedProduct = await fetchProduct(productId);
          onProductUpdate(updatedProduct);
        }
      } else {
        alert(data.error || 'Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

  const handleSetPrimaryImage = async (
    productId: number,
    catalogueId: number,
    onSuccess: () => void,
    onProductUpdate?: (product: Product) => void
  ) => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/catalog/products/${productId}/images/${catalogueId}/set-primary`,
        { method: 'PUT' }
      );

      const data = await response.json();

      if (data.success) {
        onSuccess();
        if (onProductUpdate) {
          const updatedProduct = await fetchProduct(productId);
          onProductUpdate(updatedProduct);
        }
      } else {
        alert(data.error || 'Failed to set primary image');
      }
    } catch (error) {
      console.error('Error setting primary image:', error);
      alert('Failed to set primary image');
    }
  };

  return {
    handleImageUpload,
    handleDeleteImage,
    handleSetPrimaryImage,
  };
}


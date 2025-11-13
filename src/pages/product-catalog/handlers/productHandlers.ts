import { useAuthFetch } from '../../../hooks/useAuthFetch';
import { API_BASE_URL } from '../../../config/api';
import { Product, FormData } from '../types/catalog.types';
import { transformFormDataForSubmit } from '../utils/formUtils';
import { fetchProduct } from '../queries/productQueries';

export interface ProductHandlers {
  handleSubmit: (
    e: React.FormEvent,
    formData: FormData,
    selectedProduct: Product | null,
    selectedImage: File | null,
    isFeatured: boolean,
    onSuccess: () => void,
    onImageUpload: (productId: number, file: File, isPrimary: boolean, isFeatured: boolean) => Promise<void>
  ) => Promise<void>;
  handleDeleteProduct: (productId: number, onSuccess: () => void) => Promise<void>;
  handleViewProduct: (productId: number, onSuccess: (product: Product) => void) => Promise<void>;
  openEditModal: (product: Product, onSuccess: (product: Product, formData: FormData) => void) => Promise<void>;
}

export function useProductHandlers(authFetch: ReturnType<typeof useAuthFetch>) {
  const handleSubmit = async (
    e: React.FormEvent,
    formData: FormData,
    selectedProduct: Product | null,
    selectedImage: File | null,
    isFeatured: boolean,
    onSuccess: () => void,
    onImageUpload: (productId: number, file: File, isPrimary: boolean, isFeatured: boolean) => Promise<void>
  ) => {
    e.preventDefault();
    
    try {
      const endpoint = selectedProduct 
        ? `${API_BASE_URL}/api/catalog/products/${selectedProduct.product_id}`
        : `${API_BASE_URL}/api/catalog/products`;
      
      const method = selectedProduct ? 'PUT' : 'POST';
      const submitData = transformFormDataForSubmit(formData);
      
      const response = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (data.success) {
        const productId = selectedProduct?.product_id || data.product?.product_id;
        
        if (selectedImage && productId) {
          try {
            await onImageUpload(productId, selectedImage, true, isFeatured);
          } catch (error) {
            console.error('Error uploading image:', error);
            alert('Product saved but image failed to upload');
          }
        }
        
        onSuccess();
      } else {
        alert(data.error || 'Failed to save product');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    }
  };

  const handleDeleteProduct = async (productId: number, onSuccess: () => void) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await authFetch(`${API_BASE_URL}/api/catalog/products/${productId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        alert(data.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const handleViewProduct = async (productId: number, onSuccess: (product: Product) => void) => {
    try {
      const product = await fetchProduct(productId);
      onSuccess(product);
    } catch (error) {
      console.error('Error fetching product details:', error);
      alert('Failed to fetch product details');
    }
  };

  const openEditModal = async (product: Product, onSuccess: (product: Product, formData: FormData) => void) => {
    try {
      const fullProduct = await fetchProduct(product.product_id);
      onSuccess(fullProduct, {
        product_name: fullProduct.product_name,
        description: fullProduct.description || '',
        category_id: fullProduct.category_name || fullProduct.category_id?.toString() || '',
        brand: fullProduct.brand || '',
        selling_price: fullProduct.selling_price?.toString() || '0',
        cost_price: fullProduct.cost_price?.toString() || '',
        gst_rate: fullProduct.gst_rate?.toString() || fullProduct.tax_rate?.toString() || '18',
        hsn_code: fullProduct.hsn_code || '',
        stock_quantity: fullProduct.quantity_available?.toString() || fullProduct.total_stock?.toString() || '0',
        max_stock_level: fullProduct.max_stock_level?.toString() || '',
        reorder_level: fullProduct.reorder_level?.toString() || '0',
        is_featured: fullProduct.is_featured || false,
      });
    } catch (error) {
      console.error('Error fetching product details:', error);
      // Fallback to original product data
      onSuccess(product, {
        product_name: product.product_name,
        description: product.description || '',
        category_id: product.category_name || product.category_id?.toString() || '',
        brand: product.brand || '',
        selling_price: product.selling_price?.toString() || '0',
        cost_price: product.cost_price?.toString() || '',
        gst_rate: product.gst_rate?.toString() || product.tax_rate?.toString() || '18',
        hsn_code: product.hsn_code || '',
        stock_quantity: product.quantity_available?.toString() || product.total_stock?.toString() || '0',
        max_stock_level: product.max_stock_level?.toString() || '',
        reorder_level: product.reorder_level?.toString() || '0',
        is_featured: product.is_featured || false,
      });
    }
  };

  return {
    handleSubmit,
    handleDeleteProduct,
    handleViewProduct,
    openEditModal,
  };
}


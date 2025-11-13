import { Product, FormData } from '../types/catalog.types';
import { DEFAULT_GST_RATE, DEFAULT_STOCK_QUANTITY, DEFAULT_REORDER_LEVEL } from '../constants/catalogConstants';

// Transform product to form data
export function productToFormData(product: Product): FormData {
  return {
    product_name: product.product_name,
    description: product.description || '',
    category_id: product.category_name || product.category_id?.toString() || '',
    brand: product.brand || '',
    selling_price: product.selling_price?.toString() || '0',
    cost_price: product.cost_price?.toString() || '',
    gst_rate: product.gst_rate?.toString() || product.tax_rate?.toString() || DEFAULT_GST_RATE,
    hsn_code: product.hsn_code || '',
    stock_quantity: product.quantity_available?.toString() || product.total_stock?.toString() || DEFAULT_STOCK_QUANTITY,
    max_stock_level: product.max_stock_level?.toString() || '',
    reorder_level: product.reorder_level?.toString() || DEFAULT_REORDER_LEVEL,
    is_featured: product.is_featured || false,
  };
}

// Reset form data to defaults
export function getDefaultFormData(): FormData {
  return {
    product_name: '',
    description: '',
    category_id: '',
    brand: '',
    selling_price: '',
    cost_price: '',
    gst_rate: DEFAULT_GST_RATE,
    hsn_code: '',
    stock_quantity: DEFAULT_STOCK_QUANTITY,
    max_stock_level: '',
    reorder_level: DEFAULT_REORDER_LEVEL,
    is_featured: false,
  };
}

// Transform form data for API submission
export function transformFormDataForSubmit(formData: FormData): any {
  const submitData: any = { ...formData };
  
  // Ensure is_featured is boolean (handle potential string/number values from form inputs)
  submitData.is_featured = formData.is_featured === true || 
    (typeof formData.is_featured === 'string' && formData.is_featured === 'true') || 
    (typeof formData.is_featured === 'number' && formData.is_featured === 1) || 
    (typeof formData.is_featured === 'string' && formData.is_featured === '1');
  
  // Map category_id to category
  if (submitData.category_id && submitData.category_id.trim() !== '') {
    submitData.category = submitData.category_id;
  } else {
    submitData.category = null;
  }
  delete submitData.category_id;
  
  // Map stock_quantity to quantity_available
  if (submitData.stock_quantity !== undefined) {
    submitData.quantity_available = parseInt(submitData.stock_quantity) || 0;
  }
  delete submitData.stock_quantity;
  
  return submitData;
}


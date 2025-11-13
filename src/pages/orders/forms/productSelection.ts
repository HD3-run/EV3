// Product selection handlers for order forms

import type { OrderFormData, Product } from '../types/order.types';

/**
 * Handle manual product ID input with validation
 */
export const handleManualProductIdChange = async (
  value: string,
  products: Product[],
  setManualProductId: (id: string) => void,
  setProductIdError: (error: string) => void,
  setNewOrder: (updater: (prev: OrderFormData) => OrderFormData) => void,
  setIsValidatingProductId: (validating: boolean) => void
) => {
  setManualProductId(value);
  setProductIdError('');
  
  if (!value.trim()) {
    // Clear selection if input is empty
    setNewOrder(prev => ({
      ...prev,
      productId: '',
      productName: '',
      unitPrice: 0
    }));
    return;
  }

  const productId = parseInt(value);
  if (isNaN(productId)) {
    setProductIdError('Please enter a valid product ID (number)');
    setNewOrder(prev => ({
      ...prev,
      productId: '',
      productName: '',
      unitPrice: 0
    }));
    return;
  }

  setIsValidatingProductId(true);
  
  // Find product by ID - handle both string and number comparison
  const foundProduct = products.find(p => {
    const productIdNum = typeof p.product_id === 'string' ? parseInt(p.product_id) : p.product_id;
    return productIdNum === productId || (typeof p.product_id === 'string' && p.product_id === productId.toString());
  });
  
  if (foundProduct) {
    // Product found - auto-select in dropdown and update order
    // Use selling_price if available, otherwise fall back to unit_price
    const priceToUse = foundProduct.selling_price || foundProduct.unit_price || 0;
    setNewOrder(prev => ({
      ...prev,
      productId: value,
      productName: foundProduct.product_name,
      unitPrice: priceToUse
    }));
    setProductIdError('');
  } else {
    // Product not found
    setProductIdError('Product ID not found in inventory');
    setNewOrder(prev => ({
      ...prev,
      productId: '',
      productName: '',
      unitPrice: 0
    }));
  }
  
  setIsValidatingProductId(false);
};

/**
 * Handle dropdown product selection
 */
export const handleProductDropdownChange = (
  value: string,
  products: Product[],
  setNewOrder: (updater: (prev: OrderFormData) => OrderFormData) => void,
  setManualProductId: (id: string) => void,
  setProductIdError: (error: string) => void
) => {
  if (!value) {
    // Clear selection
    setNewOrder(prev => ({
      ...prev,
      productId: '',
      productName: '',
      unitPrice: 0
    }));
    setManualProductId('');
    setProductIdError('');
    return;
  }

  const selectedProduct = products.find(p => {
    const productIdNum = typeof p.product_id === 'string' ? parseInt(p.product_id) : p.product_id;
    const valueNum = parseInt(value);
    return productIdNum === valueNum || (typeof p.product_id === 'string' && p.product_id === value);
  });
  
  if (selectedProduct) {
    // Use selling_price if available, otherwise fall back to unit_price
    const priceToUse = selectedProduct.selling_price || selectedProduct.unit_price || 0;
    setNewOrder(prev => ({
      ...prev,
      productId: value,
      productName: selectedProduct.product_name,
      unitPrice: priceToUse
    }));
    // Auto-fill manual input
    setManualProductId(value);
    setProductIdError('');
  }
};


import { API_BASE_URL } from '../../../config/api';
import type { CartItem, CheckoutData } from '../types/publicCatalog.types';
import { validateCheckoutForm } from '../utils/validation';
import { DEFAULT_COUNTRY } from '../constants/publicCatalogConstants';

export interface CheckoutCallbacks {
  onSuccess: (orderNumber: string) => void;
  onError: (message: string) => void;
  onClearCart: () => void;
  onCloseModals: () => void;
  onResetForm: () => void;
}

export async function handleCheckoutSubmit(
  merchantId: string,
  cart: CartItem[],
  checkoutData: CheckoutData,
  callbacks: CheckoutCallbacks
): Promise<void> {
  // Validate required fields
  const validation = validateCheckoutForm(checkoutData);
  if (!validation.isValid) {
    callbacks.onError(validation.error || 'Validation failed');
    return;
  }

  if (cart.length === 0) {
    callbacks.onError('Your cart is empty');
    return;
  }

  try {
    // Prepare order items
    const items = cart.map(item => ({
      productId: item.product.product_id,
      quantity: item.quantity,
      unitPrice: Number(item.product.selling_price) || 0,
    }));

    const response = await fetch(`${API_BASE_URL}/api/public/orders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchantId: parseInt(merchantId),
        customerName: checkoutData.customerName,
        customerPhone: checkoutData.customerPhone,
        customerEmail: checkoutData.customerEmail || undefined,
        addressLine1: checkoutData.addressLine1 || undefined,
        addressLine2: checkoutData.addressLine2 || undefined,
        landmark: checkoutData.landmark || undefined,
        city: checkoutData.city || undefined,
        state: checkoutData.state || undefined,
        pincode: checkoutData.pincode || undefined,
        country: checkoutData.country || DEFAULT_COUNTRY,
        alternatePhone: checkoutData.alternatePhone || undefined,
        deliveryNote: checkoutData.deliveryNote || undefined,
        state_code: checkoutData.state_code || undefined,
        gst_number: checkoutData.gst_number || undefined,
        items,
        orderSource: 'catalog',
      }),
    });

    const data = await response.json();

    if (data.success) {
      callbacks.onSuccess(data.order.order_number);
      callbacks.onClearCart();
      callbacks.onCloseModals();
      callbacks.onResetForm();
    } else {
      callbacks.onError(data.message || 'Failed to place order');
    }
  } catch (error) {
    console.error('Error placing order:', error);
    callbacks.onError('Failed to place order. Please try again.');
  }
}


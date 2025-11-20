import type { CheckoutData } from '../types/publicCatalog.types';

export function validateCheckoutForm(checkoutData: CheckoutData): { isValid: boolean; error?: string } {
  if (!checkoutData.customerName || !checkoutData.customerPhone) {
    return {
      isValid: false,
      error: 'Please fill in customer name and phone number',
    };
  }
  return { isValid: true };
}


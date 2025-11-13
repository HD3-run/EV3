import type { CartItem } from '../types/publicCatalog.types';

export function getCartTotal(cart: CartItem[]): number {
  return cart.reduce((total, item) => total + (Number(item.product.selling_price) || 0) * item.quantity, 0);
}


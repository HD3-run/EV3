import type { Product, CartItem } from '../types/publicCatalog.types';

export function addToCart(cart: CartItem[], product: Product): CartItem[] {
  const existing = cart.find(item => item.product.product_id === product.product_id);
  if (existing) {
    return cart.map(item =>
      item.product.product_id === product.product_id
        ? { ...item, quantity: item.quantity + 1 }
        : item
    );
  }
  return [...cart, { product, quantity: 1 }];
}

export function updateCartQuantity(cart: CartItem[], productId: number, delta: number): CartItem[] {
  return cart
    .map(item =>
      item.product.product_id === productId
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item
    )
    .filter(item => item.quantity > 0);
}

export function removeFromCart(cart: CartItem[], productId: number): CartItem[] {
  return cart.filter(item => item.product.product_id !== productId);
}


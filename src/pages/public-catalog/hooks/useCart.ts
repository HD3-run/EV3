import { useState, useEffect } from 'react';
import type { CartItem, Product } from '../types/publicCatalog.types';
import { savePublicCartCookie, loadPublicCartCookie, clearPublicCartCookie } from '../utils/cartCookieUtils';
import { addToCart, updateCartQuantity, removeFromCart } from '../handlers/cartHandlers';

export function useCart(merchantId: string | undefined, products: Product[]) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartRestored, setCartRestored] = useState(false);

  // Restore cart from cookie after products are loaded (only once)
  useEffect(() => {
    if (merchantId && products.length > 0 && !cartRestored) {
      const savedCart = loadPublicCartCookie(merchantId);
      if (savedCart.length > 0) {
        const restoredCart = savedCart.map(cookieItem => {
          const product = products.find(p => p.product_id === cookieItem.product_id);
          if (product) {
            return {
              product,
              quantity: cookieItem.quantity,
            };
          }
          return null;
        }).filter((item): item is CartItem => item !== null);
        
        if (restoredCart.length > 0) {
          setCart(restoredCart);
        } else {
          // If no products match, clear the cookie
          clearPublicCartCookie(merchantId);
        }
      }
      setCartRestored(true);
    }
  }, [merchantId, products, cartRestored]);

  // Save cart to cookie whenever cart changes (only if cart has full product data)
  // IMPORTANT: Only save/clear if cart restoration is complete (cartRestored = true)
  // This prevents clearing the cookie during initial load when cart is empty
  useEffect(() => {
    if (merchantId && cartRestored) {
      if (cart.length > 0) {
        // Only save if cart has full product data (not restoring from cookie)
        const hasFullData = cart.every(item => item.product.product_name);
        if (hasFullData) {
          savePublicCartCookie(merchantId, cart);
        }
      } else {
        // Clear cookie if cart is empty (but only after restoration is done)
        clearPublicCartCookie(merchantId);
      }
    }
  }, [merchantId, cart, cartRestored]);

  // Reset cart restoration when merchant changes
  useEffect(() => {
    if (merchantId) {
      setCartRestored(false);
      setCart([]);
    }
  }, [merchantId]);

  const handleAddToCart = (product: Product) => {
    setCart(prev => addToCart(prev, product));
  };

  const handleUpdateCartQuantity = (productId: number, delta: number) => {
    setCart(prev => updateCartQuantity(prev, productId, delta));
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(prev => removeFromCart(prev, productId));
  };

  const clearCart = () => {
    setCart([]);
    if (merchantId) {
      clearPublicCartCookie(merchantId);
    }
  };

  return {
    cart,
    cartRestored,
    addToCart: handleAddToCart,
    updateCartQuantity: handleUpdateCartQuantity,
    removeFromCart: handleRemoveFromCart,
    clearCart,
  };
}


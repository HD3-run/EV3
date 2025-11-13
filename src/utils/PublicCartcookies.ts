/**
 * Cookie utility functions for storing and retrieving cart data
 */

/**
 * Set a cookie with the given name, value, and expiration days
 */
export function setCookie(name: string, value: string, days: number = 30): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }
  return null;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
}

/**
 * Public cart cookie utilities - store minimal cart data (product_id and quantity only)
 */
export interface CartCookieItem {
  product_id: number;
  quantity: number;
}

/**
 * Save public cart to cookie (store only product_id and quantity to minimize size)
 */
export function savePublicCartCookie(merchantId: string, cart: { product: { product_id: number }; quantity: number }[]): void {
  const cartData: CartCookieItem[] = cart.map(item => ({
    product_id: item.product.product_id,
    quantity: item.quantity,
  }));
  
  const cookieValue = JSON.stringify(cartData);
  const cookieName = `publiccartcookie_${merchantId}`;
  
  // Cookie size limit is ~4KB, so we'll check if it's too large
  if (cookieValue.length > 3500) {
    console.warn('Cart data is too large for cookie, truncating...');
    // If too large, only keep the first items that fit
    let truncated: CartCookieItem[] = [];
    for (const item of cartData) {
      const itemSize = JSON.stringify([...truncated, item]).length;
      if (itemSize < 3500) {
        truncated.push(item);
      } else {
        break;
      }
    }
    setCookie(cookieName, JSON.stringify(truncated), 30);
  } else {
    setCookie(cookieName, cookieValue, 30);
  }
}

/**
 * Load public cart from cookie (returns product_id and quantity only)
 */
export function loadPublicCartCookie(merchantId: string): CartCookieItem[] {
  const cookieName = `publiccartcookie_${merchantId}`;
  const cookieValue = getCookie(cookieName);
  
  if (!cookieValue) {
    return [];
  }
  
  try {
    const cartData = JSON.parse(cookieValue) as CartCookieItem[];
    return Array.isArray(cartData) ? cartData : [];
  } catch (error) {
    console.error('Error parsing cart cookie:', error);
    return [];
  }
}

/**
 * Clear public cart cookie
 */
export function clearPublicCartCookie(merchantId: string): void {
  const cookieName = `publiccartcookie_${merchantId}`;
  deleteCookie(cookieName);
}


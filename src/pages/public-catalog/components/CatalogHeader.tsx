import React from 'react';
import { ShoppingCart } from 'lucide-react';
import type { Merchant, CartItem } from '../types/publicCatalog.types';

interface CatalogHeaderProps {
  merchant: Merchant | null;
  cart: CartItem[];
  onCartClick: () => void;
}

export const CatalogHeader: React.FC<CatalogHeaderProps> = ({ merchant, cart, onCartClick }) => {
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {merchant?.business_name || 'Product Catalog'}
            </h1>
            {merchant?.address && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{merchant.address}</p>
            )}
          </div>
          <button
            onClick={onCartClick}
            className="relative px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <ShoppingCart size={20} />
            Cart
            {cartItemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};


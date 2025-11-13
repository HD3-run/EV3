import React from 'react';
import { X, Plus, Minus } from 'lucide-react';
import type { CartItem } from '../types/publicCatalog.types';
import { getCartTotal } from '../utils/cartUtils';

interface CartSidebarProps {
  cart: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateQuantity: (productId: number, delta: number) => void;
  onRemoveItem: (productId: number) => void;
  onCheckout: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  cart,
  isOpen,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  if (!isOpen) return null;

  const total = getCartTotal(cart);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center sm:justify-end">
      <div className="bg-white dark:bg-gray-800 w-full sm:w-96 h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Shopping Cart</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">Your cart is empty</p>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.product.product_id} className="flex gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                  {item.product.images && item.product.images.length > 0 && (
                    <img
                      src={item.product.images[0].image_url}
                      alt={item.product.product_name}
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                      {item.product.product_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      ₹{(Number(item.product.selling_price) || 0).toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.product.product_id, -1)}
                        className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.product_id, 1)}
                        className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => onRemoveItem(item.product.product_id)}
                        className="ml-auto text-red-600 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Total:</span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                ₹{total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


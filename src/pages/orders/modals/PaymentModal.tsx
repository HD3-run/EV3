// Payment Modal Component

import { createPortal } from 'react-dom';
import { formatCurrency } from '../../../utils/currency';
import type { Order, PaymentData } from '../types/order.types';

interface PaymentModalProps {
  show: boolean;
  order: Order | null;
  paymentData: PaymentData;
  isUpdating: boolean;
  onPaymentDataChange: (data: PaymentData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function PaymentModal({
  show,
  order,
  paymentData,
  isUpdating,
  onPaymentDataChange,
  onSubmit,
  onClose
}: PaymentModalProps) {
  if (!show || !order) return null;

  const totalQuantity = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const newTotal = totalQuantity * paymentData.pricePerUnit;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Update Unit Price & Mark as Paid - Order #{order.orderId}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Unit Price:
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={paymentData.pricePerUnit}
              onChange={(e) => onPaymentDataChange({...paymentData, pricePerUnit: parseFloat(e.target.value) || 0})}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter unit price"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Method:
            </label>
            <select
              value={paymentData.paymentMethod}
              onChange={(e) => onPaymentDataChange({...paymentData, paymentMethod: e.target.value})}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Preview of new total amount */}
          {paymentData.pricePerUnit > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Preview:</strong>
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Current Total: {formatCurrency(order.amount)}
              </div>
              <div className="text-sm font-semibold text-green-700 dark:text-green-300">
                New Total: {formatCurrency(newTotal)}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={paymentData.pricePerUnit <= 0 || isUpdating}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Mark as Paid & Update Price'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


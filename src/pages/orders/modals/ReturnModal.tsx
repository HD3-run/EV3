// Return Modal Component

import { createPortal } from 'react-dom';
import type { Order, ReturnData } from '../types/order.types';

interface ReturnModalProps {
  show: boolean;
  order: Order | null;
  returnData: ReturnData;
  onReturnDataChange: (data: ReturnData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function ReturnModal({
  show,
  order,
  returnData,
  onReturnDataChange,
  onSubmit,
  onClose
}: ReturnModalProps) {
  if (!show || !order) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Return Order #{order.orderId}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Return Reason:
            </label>
            <textarea
              value={returnData.reason}
              onChange={(e) => onReturnDataChange({...returnData, reason: e.target.value})}
              placeholder="Please specify the reason for return..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Items to Return:
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {returnData.returnItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Product ID: {item.product_id}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Quantity: {item.quantity} × ₹{item.unit_price} = ₹{item.total_amount}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Original Qty:</label>
                    <input
                      type="number"
                      value={item.quantity}
                      readOnly
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!returnData.reason.trim()}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                !returnData.reason.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              Submit Return Request
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


// Add Invoice Modal Component

import { createPortal } from 'react-dom';
import type { NewInvoiceFormData } from '../types/invoice.types';

interface AddInvoiceModalProps {
  show: boolean;
  newInvoice: NewInvoiceFormData;
  onInvoiceChange: (invoice: NewInvoiceFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function AddInvoiceModal({
  show,
  newInvoice,
  onInvoiceChange,
  onSubmit,
  onClose
}: AddInvoiceModalProps) {
  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Create New Invoice</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Order ID:
            </label>
            <input
              type="text"
              placeholder="Order ID (e.g., ORD123)"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newInvoice.orderId}
              onChange={(e) => onInvoiceChange({...newInvoice, orderId: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Due Date:
            </label>
            <input
              type="date"
              placeholder="Due Date"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newInvoice.dueDate}
              onChange={(e) => onInvoiceChange({...newInvoice, dueDate: e.target.value})}
            />
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> GST will be calculated automatically based on product GST rates and customer/merchant state codes.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Discount Amount (optional):
            </label>
            <input
              type="number"
              placeholder="Discount Amount"
              step="0.01"
              min="0"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newInvoice.discountAmount}
              onChange={(e) => onInvoiceChange({...newInvoice, discountAmount: parseFloat(e.target.value) || 0})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (optional):
            </label>
            <textarea
              placeholder="Invoice notes"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newInvoice.notes}
              onChange={(e) => onInvoiceChange({...newInvoice, notes: e.target.value})}
            />
          </div>
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
            disabled={!newInvoice.orderId || !newInvoice.dueDate}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Create Invoice
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


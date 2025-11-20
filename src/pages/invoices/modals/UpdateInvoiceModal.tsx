// Update Invoice Modal Component

import { createPortal } from 'react-dom';
import type { Invoice, UpdateInvoiceFormData } from '../types/invoice.types';
import { PAYMENT_STATUSES } from '../constants/invoiceConstants';

interface UpdateInvoiceModalProps {
  show: boolean;
  editingInvoice: Invoice | null;
  updateInvoice: UpdateInvoiceFormData;
  onUpdateInvoiceChange: (invoice: UpdateInvoiceFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function UpdateInvoiceModal({
  show,
  editingInvoice,
  updateInvoice,
  onUpdateInvoiceChange,
  onSubmit,
  onClose
}: UpdateInvoiceModalProps) {
  if (!show || !editingInvoice) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Update Invoice: {editingInvoice.display_number}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Due Date:
            </label>
            <input
              type="date"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={updateInvoice.dueDate}
              onChange={(e) => onUpdateInvoiceChange({...updateInvoice, dueDate: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Status:
            </label>
            <select
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={updateInvoice.paymentStatus}
              onChange={(e) => onUpdateInvoiceChange({...updateInvoice, paymentStatus: e.target.value as any})}
            >
              {PAYMENT_STATUSES.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Method (optional):
            </label>
            <select
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={updateInvoice.paymentMethod}
              onChange={(e) => onUpdateInvoiceChange({...updateInvoice, paymentMethod: e.target.value})}
            >
              <option value="">Select Payment Method</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="net_banking">Net Banking</option>
              <option value="wallet">Wallet</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Same payment methods as used in orders</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Discount Amount:
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={updateInvoice.discountAmount}
              onChange={(e) => onUpdateInvoiceChange({...updateInvoice, discountAmount: parseFloat(e.target.value) || 0})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (optional):
            </label>
            <textarea
              placeholder="Invoice notes"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={updateInvoice.notes}
              onChange={(e) => onUpdateInvoiceChange({...updateInvoice, notes: e.target.value})}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Update Invoice
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


// Mobile/tablet card view component for invoices

import { formatCurrency } from '../../../utils/currency';
import type { Invoice } from '../types/invoice.types';

interface InvoiceCardProps {
  invoice: Invoice;
  onEditInvoice: (invoice: Invoice) => void;
}

export default function InvoiceCard({
  invoice,
  onEditInvoice
}: InvoiceCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow">
      {/* Invoice Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {invoice.display_number}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Order: ORD{invoice.order_id}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
          invoice.payment_status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          invoice.payment_status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
          invoice.payment_status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        }`}>
          {invoice.payment_status}
        </span>
      </div>

      {/* Customer Name */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {invoice.customer_name}
        </p>
      </div>

      {/* Amount Breakdown */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">Subtotal</p>
          <p className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.subtotal)}</p>
        </div>
        {invoice.cgst_amount !== undefined && invoice.cgst_amount > 0 && (
          <>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">CGST</p>
              <p className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.cgst_amount)}</p>
            </div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">SGST</p>
              <p className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.sgst_amount || 0)}</p>
            </div>
          </>
        )}
        {invoice.igst_amount !== undefined && invoice.igst_amount > 0 && (
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">IGST</p>
            <p className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.igst_amount)}</p>
          </div>
        )}
        {invoice.discount_amount > 0 && (
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Discount</p>
            <p className="text-sm text-gray-900 dark:text-white">-{formatCurrency(invoice.discount_amount)}</p>
          </div>
        )}
        <div className="border-t border-gray-300 dark:border-gray-600 pt-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(invoice.total_amount)}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {invoice.due_date}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {new Date(invoice.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => onEditInvoice(invoice)}
          className="flex-1 px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600"
        >
          Update
        </button>
        <button 
          onClick={() => {
            window.open(`/api/invoices/${invoice.invoice_id}/download`, '_blank');
          }}
          className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Download
        </button>
      </div>
    </div>
  );
}


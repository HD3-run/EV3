// Desktop table view component for invoices

import React from 'react';
import { formatCurrency } from '../../../utils/currency';
import type { Invoice } from '../types/invoice.types';

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  expandedInvoices: Set<number>;
  onToggleExpansion: (invoiceId: number) => void;
  onEditInvoice: (invoice: Invoice) => void;
}

export default function InvoiceTable({
  invoices,
  loading,
  expandedInvoices,
  onToggleExpansion,
  onEditInvoice
}: InvoiceTableProps) {
  return (
    <div className="hidden lg:block overflow-x-auto bg-slate-800/50 rounded-lg mb-6">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice Number</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">View More</th>
          </tr>
        </thead>
        <tbody className="bg-light-pink-100 dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                {loading ? 'Loading invoices...' : 'No invoices found. Create invoices from orders or upload CSV data.'}
              </td>
            </tr>
          ) : (
            invoices.map((invoice) => (
              <React.Fragment key={invoice.invoice_id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{invoice.display_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">ORD{invoice.order_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{invoice.customer_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(invoice.total_amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      invoice.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.payment_status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800' :
                      invoice.payment_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {invoice.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onToggleExpansion(invoice.invoice_id)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm font-medium px-3 py-1 rounded border border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
                    >
                      {expandedInvoices.has(invoice.invoice_id) ? 'View Less' : 'View More'}
                    </button>
                  </td>
                </tr>
                
                {expandedInvoices.has(invoice.invoice_id) && (
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subtotal</label>
                          <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.subtotal)}</div>
                        </div>
                        {invoice.cgst_amount !== undefined && invoice.cgst_amount > 0 && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">CGST</label>
                              <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.cgst_amount)}</div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">SGST</label>
                              <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.sgst_amount || 0)}</div>
                            </div>
                          </>
                        )}
                        {invoice.igst_amount !== undefined && invoice.igst_amount > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">IGST</label>
                            <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.igst_amount)}</div>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Discount</label>
                          <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.discount_amount)}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Due Date</label>
                          <div className="text-sm text-gray-900 dark:text-white">{invoice.due_date}</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Actions</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => onEditInvoice(invoice)}
                            className="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            Update
                          </button>
                          <button 
                            onClick={() => {
                              window.open(`/api/invoices/${invoice.invoice_id}/download`, '_blank');
                            }}
                            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}


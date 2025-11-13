// Invoice action handlers

import { getApiUrl } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import type { Invoice, NewInvoiceFormData, UpdateInvoiceFormData } from '../types/invoice.types';

export interface InvoiceHandlersCallbacks {
  setShowAddModal: (show: boolean) => void;
  setNewInvoice: (invoice: NewInvoiceFormData) => void;
  setShowUpdateModal: (show: boolean) => void;
  setEditingInvoice: (invoice: Invoice | null) => void;
  loadInvoices: () => Promise<void>;
}

/**
 * Handle adding a new invoice
 */
export async function handleAddInvoice(
  newInvoice: NewInvoiceFormData,
  callbacks: InvoiceHandlersCallbacks
): Promise<void> {
  try {
    const response = await fetch(getApiUrl('/api/invoices/add-manual'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(newInvoice)
    });
    
    if (response.ok) {
      const result = await response.json();
      alert(`Invoice created successfully!\nInvoice Number: ${result.invoice.display_number}\nTotal Amount: ${formatCurrency(result.invoice.total_amount)}`);
      callbacks.setShowAddModal(false);
      callbacks.setNewInvoice({ orderId: '', dueDate: '', notes: '', discountAmount: 0 });
      await callbacks.loadInvoices();
    } else {
      const errorData = await response.json();
      alert(`Failed to create invoice: ${errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    alert('Failed to create invoice: Network error');
  }
}

/**
 * Handle editing an invoice (opens update modal)
 */
export function handleEditInvoice(
  invoice: Invoice,
  callbacks: InvoiceHandlersCallbacks
): void {
  callbacks.setEditingInvoice(invoice);
  callbacks.setShowUpdateModal(true);
}

/**
 * Handle updating an invoice
 */
export async function handleUpdateInvoice(
  invoice: Invoice,
  updateInvoice: UpdateInvoiceFormData,
  callbacks: InvoiceHandlersCallbacks
): Promise<void> {
  if (!invoice) return;

  try {
    const response = await fetch(getApiUrl(`/api/invoices/${invoice.invoice_id}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(updateInvoice)
    });
    
    if (response.ok) {
      alert('Invoice updated successfully!');
      callbacks.setShowUpdateModal(false);
      callbacks.setEditingInvoice(null);
      await callbacks.loadInvoices();
    } else {
      const errorData = await response.json();
      alert(`Failed to update invoice: ${errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    alert('Failed to update invoice: Network error');
  }
}


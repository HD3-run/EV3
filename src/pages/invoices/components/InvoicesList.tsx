// Wrapper component that renders table or cards based on screen size

import InvoiceTable from './InvoiceTable';
import InvoiceCard from './InvoiceCard';
import type { Invoice } from '../types/invoice.types';

interface InvoicesListProps {
  invoices: Invoice[];
  loading: boolean;
  expandedInvoices: Set<number>;
  onToggleExpansion: (invoiceId: number) => void;
  onEditInvoice: (invoice: Invoice) => void;
}

export default function InvoicesList({
  invoices,
  loading,
  expandedInvoices,
  onToggleExpansion,
  onEditInvoice
}: InvoicesListProps) {
  return (
    <>
      {/* Desktop Table View - Hidden on Mobile/Tablet */}
      <InvoiceTable
        invoices={invoices}
        loading={loading}
        expandedInvoices={expandedInvoices}
        onToggleExpansion={onToggleExpansion}
        onEditInvoice={onEditInvoice}
      />

      {/* Mobile/Tablet Card View - Hidden on Desktop */}
      <div className="lg:hidden grid gap-4 mb-6">
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 card-surface rounded-card shadow p-6">
            {loading ? 'Loading invoices...' : 'No invoices found. Create invoices from orders or upload CSV data.'}
          </div>
        ) : (
          invoices.map((invoice) => (
            <InvoiceCard
              key={invoice.invoice_id}
              invoice={invoice}
              onEditInvoice={onEditInvoice}
            />
          ))
        )}
      </div>
    </>
  );
}


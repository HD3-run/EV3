import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import FileUpload from '../components/FileUpload';
import DownloadDropdown from '../components/DownloadDropdown';

// Import extracted types
import type { Invoice } from './invoices/types/invoice.types';

// Import extracted components
import SearchToolbar from './invoices/components/SearchToolbar';
import InvoicesList from './invoices/components/InvoicesList';
import Pagination from './invoices/components/Pagination';

// Import extracted modals
import AddInvoiceModal from './invoices/modals/AddInvoiceModal';
import UpdateInvoiceModal from './invoices/modals/UpdateInvoiceModal';

// Import extracted handlers
import { handleAddInvoice, handleEditInvoice, handleUpdateInvoice } from './invoices/handlers/invoiceHandlers';
import { handleFileUpload } from './invoices/handlers/fileHandlers';
import { handleDownloadCSV, handleDownloadExcel, handleDownloadPDF } from './invoices/handlers/exportHandlers';

// Import extracted hooks
import { useInvoiceManagement } from './invoices/hooks/useInvoiceManagement';

export default function Invoices() {
  const { user } = useAuth();
  useTheme();
  const userRole = user?.role || 'admin';

  // Use custom hook for invoice management
  const {
    invoices,
    loading,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    currentPage,
    totalCount,
    totalPages,
    expandedInvoices,
    currentUploadId,
    setCurrentUploadId,
    showAddModal,
    setShowAddModal,
    showUpdateModal,
    setShowUpdateModal,
    editingInvoice,
    setEditingInvoice,
    newInvoice,
    setNewInvoice,
    updateInvoice,
    setUpdateInvoice,
    loadInvoices,
    toggleExpansion,
    handlePageChange,
    itemsPerPage
  } = useInvoiceManagement();

  // Handler wrappers
  const handleAddInvoiceWrapper = async () => {
    await handleAddInvoice(newInvoice, {
      setShowAddModal,
      setNewInvoice,
      setShowUpdateModal,
      setEditingInvoice,
      loadInvoices
    });
  };

  const handleEditInvoiceWrapper = (invoice: Invoice) => {
    handleEditInvoice(invoice, {
      setShowAddModal,
      setNewInvoice,
      setShowUpdateModal,
      setEditingInvoice,
      loadInvoices
    });
  };

  const handleUpdateInvoiceWrapper = async () => {
    if (!editingInvoice) return;
    await handleUpdateInvoice(editingInvoice, updateInvoice, {
      setShowAddModal,
      setNewInvoice,
      setShowUpdateModal,
      setEditingInvoice,
      loadInvoices
    });
  };

  const handleFileUploadWrapper = async (file: File): Promise<void> => {
    await handleFileUpload(file, {
      setCurrentUploadId,
      loadInvoices
    });
  };

  if (loading && invoices.length === 0) {
    return (
      <Layout>
        <h1 className="text-3xl font-bold heading-gradient mb-6">Invoice Management</h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-slate-300">Loading invoices...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-3xl font-bold heading-gradient mb-6">Invoice Management</h1>

      <SearchToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
      />

      {userRole === 'admin' && (
        <div className="mb-6 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <FileUpload 
            onFileUpload={handleFileUploadWrapper} 
            buttonLabel="Upload CSV" 
            showProgress={true} 
            uploadId={currentUploadId || undefined} 
          />
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mr-2">CSV Upload Format:</h3>
            <div className="relative group">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-blue-600 dark:text-blue-300 cursor-pointer">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-80 p-3 rounded-lg shadow-lg bg-gray-800 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    <p className="mb-1">Your CSV file should include these columns:</p>
                    <p className="font-mono">order_id, due_date, notes, discount_amount</p>
                    <p className="mt-2"><strong>Example:</strong> 1, 2024-02-15, "Invoice notes", 10.00</p>
                    <p className="mt-1"><strong>Note:</strong> GST is calculated automatically from product rates. Invoice number is auto-generated.</p>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-800 rotate-45"></div>
                </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <button
          onClick={() => setShowAddModal(true)}
          className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors w-full"
        >
          Create Invoice Manually
        </button>
        
        <DownloadDropdown
          onDownloadCSV={() => handleDownloadCSV(invoices)}
          onDownloadExcel={() => handleDownloadExcel(invoices)}
          onDownloadPDF={() => handleDownloadPDF(invoices)}
        />
      </div>
      
      <InvoicesList
        invoices={invoices}
        loading={loading}
        expandedInvoices={expandedInvoices}
        onToggleExpansion={toggleExpansion}
        onEditInvoice={handleEditInvoiceWrapper}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
      />

      {/* Modals */}
      <AddInvoiceModal
        show={showAddModal}
        newInvoice={newInvoice}
        onInvoiceChange={setNewInvoice}
        onSubmit={handleAddInvoiceWrapper}
        onClose={() => setShowAddModal(false)}
      />

      <UpdateInvoiceModal
        show={showUpdateModal}
        editingInvoice={editingInvoice}
        updateInvoice={updateInvoice}
        onUpdateInvoiceChange={setUpdateInvoice}
        onSubmit={handleUpdateInvoiceWrapper}
        onClose={() => setShowUpdateModal(false)}
      />
    </Layout>
  );
}

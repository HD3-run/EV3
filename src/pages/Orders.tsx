import { useState } from "react";
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';

// Import extracted modals
import AssignmentModal from './orders/modals/AssignmentModal';
import ProcessingErrorsModal from './orders/modals/ProcessingErrorsModal';
import CustomerDetailsModal from './orders/modals/CustomerDetailsModal';
import ReturnModal from './orders/modals/ReturnModal';
import PaymentModal from './orders/modals/PaymentModal';
import AddOrderModal from './orders/modals/AddOrderModal';

// Import extracted components
import MetricsCards from './orders/components/MetricsCards';
import SearchToolbar from './orders/components/SearchToolbar';
import OrdersList from './orders/components/OrdersList';
import Pagination from './orders/components/Pagination';

// Import extracted types
import type { Order, OrderFormData, FormErrors } from './orders/types/order.types';

// Import extracted utilities
import { clearProcessingErrors, updateProcessingErrors, loadProcessingErrors } from './orders/utils/clearProcessingErrors';
import { toggleOrderExpansion } from './orders/utils/toggleOrderExpansion';
import { handleDownloadCSV, handleDownloadExcel, handleDownloadPDF } from './orders/utils/exportUtils';

// Import extracted form handlers
import { handlePincodeLookup, autoPopulateAddress } from './orders/forms/addressHandlers';
import { handleManualProductIdChange, handleProductDropdownChange } from './orders/forms/productSelection';
import { handlePhoneChange, handleEmailChange } from './orders/forms/customerFormFields';

// Import extracted handlers
import { handlePaymentUpdate, handlePaymentClick, submitPayment } from './orders/handlers/paymentHandlers';
import { handleAddOrder, handleStatusUpdate } from './orders/handlers/orderHandlers';
import { submitReturn, handleReturnClick, handleReturnOrder, handleAssignOrder, submitAssignment } from './orders/handlers/returnHandlers';
import { handleFileUpload } from './orders/handlers/fileHandlers';
import { handleViewCustomerDetails } from './orders/handlers/customerHandlers';

// Import extracted hooks
import { useOrderManagement } from './orders/hooks/useOrderManagement';
import { useWebSocketOrders } from './orders/hooks/useWebSocketOrders';
import { useOrderFilters } from './orders/hooks/useOrderFilters';

export default function Orders() {
  const { user } = useAuth();
  const { isConnected } = useWebSocket();
  const userRole = user?.role || 'admin';

  // Use custom hook for order management
  const orderManagement = useOrderManagement(userRole);
  const {
    orders,
    setOrders,
    loading,
    totalOrders,
    totalRevenue,
    setTotalRevenue,
    pendingOrders,
    setPendingOrders,
    todayOrders,
    filterType,
    setFilterType,
    sortKey,
    setSortKey,
    sortOrder,
    setSortOrder,
    searchTerm,
    setSearchTerm,
    appliedSearchTerm,
    searchInputRef,
    currentPage,
    employees,
    products,
    loadOrdersWrapper,
    loadTotalOrdersWrapper,
    loadMetricsWrapper,
    handlePageChange,
    handleSearchKeyDown
  } = orderManagement;

  // Use WebSocket hook
  useWebSocketOrders({
    isConnected,
    setOrders,
    setTotalRevenue,
    setPendingOrders,
    loadMetricsWrapper,
    loadOrdersWrapper
  });

  // Use filter hook
  const filteredAndSortedOrders = useOrderFilters(
    orders,
    appliedSearchTerm,
    filterType,
    sortKey,
    sortOrder
  );

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [assignmentData, setAssignmentData] = useState({
    userId: '',
    deliveryNotes: ''
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnData, setReturnData] = useState({
    reason: '',
    returnItems: [] as Array<{
      product_id: number;
      quantity: number;
      unit_price: number;
      total_amount: number;
    }>
  });
  const [processingErrors, setProcessingErrors] = useState<string[]>(loadProcessingErrors);
  const [showErrorsModal, setShowErrorsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<Order | null>(null);
  const [paymentData, setPaymentData] = useState({
    pricePerUnit: 0,
    paymentMethod: 'cash'
  });
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [newOrder, setNewOrder] = useState<OrderFormData>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    alternatePhone: '',
    isVerifiedAddress: false,
    deliveryNote: '',
    state_code: '',
    gst_number: '',
    productId: '',
    productName: '',
    quantity: 1,
    unitPrice: 0,
    orderSource: 'Manual'
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: '',
    alternatePhone: '',
    deliveryNote: '',
    productName: ''
  });
  const [manualProductId, setManualProductId] = useState('');
  const [productIdError, setProductIdError] = useState('');
  const [isValidatingProductId, setIsValidatingProductId] = useState(false);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [showCustomerDetailsModal, setShowCustomerDetailsModal] = useState(false);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<any>(null);

  // Handler wrappers
  const handleClearProcessingErrors = () => {
    clearProcessingErrors(setProcessingErrors, setShowErrorsModal);
  };

  const handlePincodeLookupWrapper = async (pincode: string) => {
    await handlePincodeLookup(pincode, setNewOrder, setPincodeLoading);
  };

  const handleAutoPopulateAddress = (landmark: string, pincode: string) => {
    autoPopulateAddress(landmark, pincode, setNewOrder, handlePincodeLookupWrapper);
  };

  const handlePhoneChangeWrapper = (value: string) => {
    handlePhoneChange(value, setNewOrder, formErrors, setFormErrors);
  };

  const handleEmailChangeWrapper = (value: string) => {
    handleEmailChange(value, setNewOrder, formErrors, setFormErrors);
  };

  const handleManualProductIdChangeWrapper = async (value: string) => {
    await handleManualProductIdChange(
      value,
      products,
      setManualProductId,
      setProductIdError,
      setNewOrder,
      setIsValidatingProductId
    );
  };

  const handleProductDropdownChangeWrapper = (value: string) => {
    handleProductDropdownChange(
      value,
      products,
      setNewOrder,
      setManualProductId,
      setProductIdError
    );
  };

  const handleAddOrderWrapper = async () => {
    await handleAddOrder(newOrder, {
      setFormErrors,
      setOrders,
      setShowAddOrderModal,
      setNewOrder,
      setManualProductId,
      setProductIdError,
      setIsValidatingProductId,
      loadTotalOrdersWrapper
    });
  };

  const handleStatusUpdateWrapper = async (orderId: string, newStatus: string) => {
    await handleStatusUpdate(orderId, newStatus, orders, userRole, { 
      setOrders, 
      loadOrders: loadOrdersWrapper 
    });
  };

  const handlePaymentUpdateWrapper = async (orderId: number, paymentStatus: string, paymentMethod: string = 'cash', amount?: number, pricePerUnit?: number) => {
    await handlePaymentUpdate(
      { orderId, paymentStatus, paymentMethod, amount, pricePerUnit },
      { setUpdatingOrderId, setOrders, setTotalRevenue, setPendingOrders }
    );
  };

  const handlePaymentClickWrapper = (order: Order, status: string) => {
    handlePaymentClick(order, status, {
      setSelectedPaymentOrder,
      setPaymentData,
      setShowPaymentModal,
      handlePaymentUpdate: (orderId: number, status: string) => handlePaymentUpdateWrapper(orderId, status)
    });
  };

  const submitPaymentWrapper = async () => {
    await submitPayment(selectedPaymentOrder, paymentData, {
      setIsUpdatingPayment,
      handlePaymentUpdate: handlePaymentUpdateWrapper,
      setShowPaymentModal,
      setSelectedPaymentOrder,
      setPaymentData
    });
  };

  const submitReturnWrapper = async () => {
    await submitReturn(selectedOrder, returnData, {
      loadOrdersWrapper,
      setShowReturnModal,
      setReturnData,
      setSelectedOrder
    });
  };

  const handleReturnClickWrapper = (order: Order) => {
    handleReturnClick(order, {
      setSelectedOrder,
      setReturnData,
      setShowReturnModal
    });
  };

  const handleReturnOrderWrapper = (order: Order) => {
    handleReturnOrder(order, {
      handleReturnClick: handleReturnClickWrapper
    });
  };

  const handleAssignOrderWrapper = (order: Order) => {
    handleAssignOrder(order);
    setSelectedOrder(order);
    setShowAssignModal(true);
  };

  const submitAssignmentWrapper = async () => {
    setIsAssigning(true);
    try {
      await submitAssignment(selectedOrder, assignmentData, {
        setShowAssignModal,
        setSelectedOrder,
        setAssignmentData,
        loadOrdersWrapper
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleViewCustomerDetailsWrapper = async (customerId: string) => {
    await handleViewCustomerDetails(customerId, {
      setSelectedCustomerDetails,
      setShowCustomerDetailsModal
    });
  };

  const handleFileUploadWrapper = async (file: File) => {
    await handleFileUpload(file, {
      setCurrentUploadId,
      setProcessingErrors,
      loadOrdersWrapper,
      loadTotalOrders: loadTotalOrdersWrapper
    });
  };

  const handleToggleExpansion = (orderId: string) => {
    toggleOrderExpansion(orderId, expandedOrders, setExpandedOrders);
  };

    return (
      <Layout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">Orders</h1>
          
          <MetricsCards
            totalOrders={totalOrders}
            totalRevenue={totalRevenue}
            pendingOrders={pendingOrders}
            todayOrders={todayOrders}
          />

          <SearchToolbar
            searchTerm={searchTerm}
            searchInputRef={searchInputRef}
            onSearchChange={setSearchTerm}
            onSearchKeyDown={handleSearchKeyDown}
            filterType={filterType}
            onFilterChange={(value) => setFilterType(value as typeof filterType)}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
            sortOrder={sortOrder}
            onSortOrderToggle={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            onAddOrderClick={() => setShowAddOrderModal(true)}
            onFileUpload={handleFileUploadWrapper}
            currentUploadId={currentUploadId}
            onProcessingErrors={(errors) => updateProcessingErrors(errors, setProcessingErrors)}
            onDownloadCSV={() => handleDownloadCSV(filteredAndSortedOrders)}
            onDownloadExcel={() => handleDownloadExcel(filteredAndSortedOrders)}
            onDownloadPDF={() => handleDownloadPDF(filteredAndSortedOrders)}
            processingErrorsCount={processingErrors.length}
            onErrorsClick={() => setShowErrorsModal(true)}
            userRole={userRole}
          />
              </div>

        <OrdersList
          loading={loading}
          orders={filteredAndSortedOrders}
          expandedOrders={expandedOrders}
          updatingOrderId={updatingOrderId}
          onToggleExpansion={handleToggleExpansion}
          onViewCustomerDetails={handleViewCustomerDetailsWrapper}
          onPaymentClick={handlePaymentClickWrapper}
          onReturnOrder={handleReturnOrderWrapper}
          onAssignClick={handleAssignOrderWrapper}
          onStatusUpdate={handleStatusUpdateWrapper}
          userRole={userRole}
        />

        <Pagination
          currentPage={currentPage}
          totalOrders={totalOrders}
          onPageChange={handlePageChange}
                      />
                    </div>

      {/* Modals */}
      <AssignmentModal
        show={showAssignModal}
        order={selectedOrder}
        employees={employees}
        assignmentData={assignmentData}
        onAssignmentDataChange={setAssignmentData}
        onSubmit={submitAssignmentWrapper}
        onClose={() => setShowAssignModal(false)}
        isSubmitting={isAssigning}
      />

      <AddOrderModal
        show={showAddOrderModal}
        newOrder={newOrder}
        formErrors={formErrors}
        products={products}
        manualProductId={manualProductId}
        productIdError={productIdError}
        isValidatingProductId={isValidatingProductId}
        pincodeLoading={pincodeLoading}
        onOrderChange={setNewOrder}
        onManualProductIdChange={handleManualProductIdChangeWrapper}
        onProductDropdownChange={handleProductDropdownChangeWrapper}
        onPhoneChange={handlePhoneChangeWrapper}
        onEmailChange={handleEmailChangeWrapper}
        onAutoPopulateAddress={handleAutoPopulateAddress}
        onSubmit={handleAddOrderWrapper}
        onClose={() => setShowAddOrderModal(false)}
      />

      <PaymentModal
        show={showPaymentModal}
        order={selectedPaymentOrder}
        paymentData={paymentData}
        isUpdating={isUpdatingPayment}
        onPaymentDataChange={setPaymentData}
        onSubmit={submitPaymentWrapper}
        onClose={() => setShowPaymentModal(false)}
      />

      <CustomerDetailsModal
        show={showCustomerDetailsModal}
        customerDetails={selectedCustomerDetails}
        onClose={() => {
                  setShowCustomerDetailsModal(false);
                  setSelectedCustomerDetails(null);
                }}
      />

      <ReturnModal
        show={showReturnModal}
        order={selectedOrder}
        returnData={returnData}
        onReturnDataChange={setReturnData}
        onSubmit={submitReturnWrapper}
        onClose={() => {
                    setShowReturnModal(false);
                    setReturnData({ reason: '', returnItems: [] });
                    setSelectedOrder(null);
                  }}
      />

      <ProcessingErrorsModal
        show={showErrorsModal}
        errors={processingErrors}
        onClear={handleClearProcessingErrors}
        onClose={() => setShowErrorsModal(false)}
      />
    </Layout>
  );
}

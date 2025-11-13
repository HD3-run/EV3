# Orders Modularization Audit

## Frontend (Orders.tsx - 2853 lines)

### State Variables (40+)
- orders, loading, totalOrders, totalRevenue, pendingOrders, todayOrders
- filterType, sortKey, sortOrder, searchTerm
- showAssignModal, selectedOrder, employees, assignmentData
- showReturnModal, returnData
- processingErrors, showErrorsModal
- showPaymentModal, selectedPaymentOrder, paymentData, isUpdatingPayment, updatingOrderId
- showAddOrderModal, newOrder, products, manualProductId, productIdError, isValidatingProductId
- formErrors, currentUploadId, expandedOrders, pincodeLoading
- showCustomerDetailsModal, selectedCustomerDetails
- currentPage, itemsPerPage

### Functions
1. **Validation**: validatePhoneNumber, validateEmail, validateForm
2. **Address Handling**: handlePincodeLookup, autoPopulateAddress
3. **Form Handlers**: handlePhoneChange, handleEmailChange, handleManualProductIdChange, handleProductDropdownChange
4. **API Calls**: loadOrders, loadMetrics, loadTotalOrders, loadCustomerDetails, loadEmployees, loadProducts
5. **Order Actions**: handleAssignOrder, handleReturnOrder, submitReturn, submitAssignment, handleStatusUpdate, handlePaymentUpdate, handlePaymentClick, submitPayment, handleAddOrder
6. **File Operations**: handleFileUpload, handleDownloadCSV, handleDownloadExcel, handleDownloadPDF
7. **Utilities**: toggleOrderExpansion, updateProcessingErrors, clearProcessingErrors
8. **Sorting**: sortedOrders (useMemo)

### useEffect Hooks
1. URL parameter handling on mount
2. Metrics loading on mount
3. Focus event listener for metrics refresh
4. WebSocket order status updates
5. Filter change handler

### Modals (6)
1. AssignModal
2. ReturnModal
3. PaymentModal
4. AddOrderModal
5. CustomerDetailsModal
6. ErrorsModal

### Components/UI Sections
1. Summary Cards (Total Orders, Revenue, Pending, Today)
2. Search & Filter Controls
3. Sort Controls
4. Desktop Table View
5. Mobile/Tablet Card View
6. Pagination Controls
7. File Upload Section
8. Download Dropdown

### Integration Points
- Invoice page: Auto-invoice creation on payment
- Returns page: Return order submission
- Inventory/Product Catalog: Product selection for orders
- WebSocket: Real-time order updates

## Backend (orders.ts - 2153 lines)

### Routes (11)
1. GET / - Get all orders with pagination/filtering
2. POST /add-manual - Create manual order
3. POST / - Create bulk order
4. POST /upload-csv - CSV upload with batch processing
5. POST /create-sample - Create sample data (dev only)
6. GET /debug - Debug endpoint (dev only)
7. PATCH /:id/price - Update order item prices
8. PATCH /:id/payment - Update payment status (with invoice auto-creation)
9. POST /assign - Assign order to employee
10. PATCH /:id/status - Update order status
11. POST /return - Create return request

### Helper Functions
- createInvoiceFromPaidOrder - Auto-create invoice with GST calculation

### Database Queries
- Order list with JOINs (customers, payments, order_items, products)
- Order details queries
- Customer lookup/creation
- Product/inventory validation
- Payment status updates
- Invoice creation queries
- Order assignment queries
- Return processing queries
- CSV batch processing queries

### Integration Points
- Invoice system: Auto-invoice creation
- Returns system: Return processing
- Inventory system: Product validation
- WebSocket: Real-time notifications

## Critical Features to Preserve
1. All validation logic (phone, email, form)
2. Pincode lookup and address auto-population
3. Product selection from inventory (by ID or name)
4. Metrics calculation (total, revenue, pending, today)
5. Search by customer ID, Order ID
6. Filter by status
7. Sort by ID, date, amount (Asc/Desc)
8. CSV upload with batch processing (500 per batch)
9. Download options (CSV, Excel, PDF)
10. Payment status updates with price_per_unit changes
11. Auto-invoice creation on payment
12. Return order processing
13. Order assignment (currently disabled)
14. WebSocket real-time updates
15. Order expansion/collapse
16. Customer details modal
17. Processing errors modal with localStorage persistence
18. URL parameter handling (status, date filters)
19. Pagination (50 items per page)
20. Role-based access (admin vs employee)


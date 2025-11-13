# Invoice Modularization Complete Audit

## Frontend (Invoices.tsx - 831 lines)

### State Variables (13)
- invoices, loading, searchTerm, filterStatus
- showAddModal, newInvoice (orderId, dueDate, notes, discountAmount)
- currentUploadId
- showUpdateModal, editingInvoice, updateInvoice (dueDate, notes, discountAmount, paymentStatus, paymentMethod)
- expandedInvoices (Set<number>)
- currentPage, itemsPerPage (50), totalCount, totalPages

### Functions (9)
1. **toggleInvoiceExpansion** (line 67) → `utils/toggleExpansion.ts`
2. **loadInvoices** (line 87) → `queries/invoiceQueries.ts`
3. **handleFileUpload** (line 115) → `handlers/fileHandlers.ts`
4. **handleAddInvoice** (line 150) → `handlers/invoiceHandlers.ts`
5. **handleEditInvoice** (line 176) → `handlers/invoiceHandlers.ts`
6. **handleUpdateInvoice** (line 188) → `handlers/invoiceHandlers.ts`
7. **handleDownloadCSV** (line 215) → `handlers/exportHandlers.ts`
8. **handleDownloadExcel** (line 247) → `handlers/exportHandlers.ts`
9. **handleDownloadPDF** (line 270) → `handlers/exportHandlers.ts`

### useEffect Hooks (2)
1. Load invoices on mount/page/filter change (line 83) → `hooks/useInvoiceManagement.ts`
2. Reset to page 1 on filter change (line 304) → `hooks/useInvoiceManagement.ts`

### UI Components/Sections
1. **SearchToolbar** (lines 328-347) → `components/SearchToolbar.tsx`
2. **FileUpload Section** (lines 349-369) → Keep in main (admin-only conditional)
3. **Create Button** (lines 371-377) → Keep in main
4. **DownloadDropdown** (lines 379-383) → Keep in main
5. **Desktop Table** (lines 387-497) → `components/InvoiceTable.tsx`
6. **Pagination** (lines 500-525) → `components/Pagination.tsx`
7. **Mobile Cards** (lines 528-643) → `components/InvoiceCard.tsx` + `components/InvoicesList.tsx`
8. **AddInvoiceModal** (lines 646-726) → `modals/AddInvoiceModal.tsx`
9. **UpdateInvoiceModal** (lines 729-828) → `modals/UpdateInvoiceModal.tsx`

### Types
- Invoice interface (lines 14-37) → `types/invoice.types.ts`

## Backend (invoices.ts - 1354 lines)

### Helper Functions (2)
1. **generateInvoiceNumber** (line 16) → `services/invoiceNumberService.ts`
2. **createInvoiceFromOrder** (line 49) → `services/invoiceService.ts`
   - Includes: Order lookup, billing details lookup, GST calculation (CGST/SGST/IGST), invoice creation, invoice items insertion

### Routes (7)
1. **GET /** (line 213) - Get all invoices with pagination/filtering
   - Query logic → `queries/invoice-queries.ts`
   - Response mapping → Keep in route or move to service
   
2. **POST /add-manual** (line 320) - Create manual invoice
   - Order ID parsing (ORD123 format) → `services/invoiceService.ts`
   - Uses createInvoiceFromOrder → `services/invoiceService.ts`
   - WebSocket emission → Keep in route
   
3. **POST /upload-csv** (line 414) - CSV upload with batch processing
   - CSV parsing → `services/csvService.ts`
   - Batch processing (500 per batch) → `services/csvService.ts`
   - WebSocket progress events → `services/csvService.ts`
   - Uses createInvoiceFromOrder → `services/invoiceService.ts`
   
4. **GET /:id/items** (line 697) - Get invoice details with items
   - Invoice query → `queries/invoice-item-queries.ts`
   - Items query → `queries/invoice-item-queries.ts`
   - Response mapping → Keep in route or move to service
   
5. **PATCH /:id/status** (line 787) - Update payment status only
   - Validation → `services/invoiceUpdateService.ts`
   - Update query → `services/invoiceUpdateService.ts`
   - WebSocket emission → Keep in route
   
6. **PATCH /:id** (line 875) - Update invoice details
   - Validation → `services/invoiceUpdateService.ts`
   - Total amount recalculation (preserve GST) → `services/invoiceUpdateService.ts`
   - Dynamic update query → `services/invoiceUpdateService.ts`
   - WebSocket emission → Keep in route
   
7. **GET /:id/download** (line 1093) - Download PDF
   - Invoice query with billing details → `queries/billing-queries.ts`
   - Items query → `queries/invoice-item-queries.ts`
   - PDF generation → `services/pdfService.ts`
   - PDF layout (header, customer/seller, items table, GST breakdown, bank details) → `services/pdfService.ts`

### Database Queries (to extract)
1. Get invoices with pagination/filtering (lines 247-275)
2. Get order details for invoice creation (lines 62-68)
3. Get merchant billing details (lines 80-83)
4. Get order items with GST (lines 105-112)
5. Insert invoice (lines 172-180)
6. Insert invoice items (lines 186-194)
7. Get invoice with items (lines 715-736)
8. Update invoice status (lines 820-828)
9. Update invoice details (lines 1019-1024)
10. Get invoice for PDF (lines 1111-1139)
11. Get invoice items for PDF (lines 1148-1156)

### GST Calculation Logic
- Intra-state vs inter-state determination (lines 130-133)
- CGST/SGST split for intra-state (lines 145-150)
- IGST for inter-state (lines 152-154)
- Total GST calculation (line 166)
- → Extract to `services/gstCalculationService.ts` or keep in `invoiceService.ts`

### WebSocket Events
- invoice-created (line 374)
- csv-upload-progress (lines 504, 553, 615, 650, 687)
- invoice-status-updated (line 846)
- invoice-updated (line 1046)
- → Keep in routes (or create WebSocket service if pattern exists)

### Constants
- BATCH_SIZE = 500 (line 512)
- Payment statuses: ['unpaid', 'paid', 'partially_paid', 'cancelled'] (lines 806, 919)
- PAYMENT_METHODS (imported from constants)

## Missing from Original Plan

### Backend Queries (Additional)
- `order-queries.ts` - Get order details (used in createInvoiceFromOrder)
- `billing-queries.ts` - Get merchant billing details (used in createInvoiceFromOrder and PDF)

### Backend Services (Additional)
- `invoiceNumberService.ts` - Generate invoice number (atomic operation)
- `gstCalculationService.ts` - GST calculation logic (or keep in invoiceService)

### Backend Utils (If needed)
- `validation.ts` - Payment status/method validation (or keep in services)


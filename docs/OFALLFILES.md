# EZPZ-V3 File-by-File Documentation (OFALLFILES)

This document explains the purpose and internal flow of the most important files across backend and frontend. It complements SYSDOC.md (API, architecture, diagrams, dev guide) with a per-file view you can expand over time.

Conventions
- Events: names like `orderCreated`, `invoice-auto-created`, `inventory-*`, `csv-upload-progress` are emitted via Socket.IO (`io.emit`).
- Layers: Router (controller) → Service (business logic) → Query (SQL) → Emit → Response.

Index (modules covered below)
- Backend core: backend/index.ts, backend/routes.ts, backend/db.ts
- Middleware: backend/middleware/* (auth, cache, csrf, rate-limit, validation, session-security)
- Orders: backend/orders.ts, backend/orders/services/csvService.ts, backend/orders/queries/*
- Inventory: backend/inventory.ts, backend/inventory/services/csvService.ts, backend/inventory/queries/*
- Invoices: backend/invoices.ts, backend/invoices/services/csvService.ts
- Catalog: backend/product-catalog/*, backend/public-catalog/*
- Public Orders: backend/public-orders/*
- Returns + Reports: backend/returns/*, backend/reports/*
- Utilities: backend/utils/* (query-builder, secure-query, jwt, logger, s3-config, indexes.sql, batch-processor)
- Frontend: src/context/WebSocketContext.tsx, src/components/FileUpload.tsx, src/components/ProgressModal.tsx, src/pages/*

---

backend/index.ts (Server bootstrap)
- Creates Express app, attaches middleware (compression, cors, sessions, auth, validation, rate limits).
- Initializes Socket.IO and exposes global `io` for emits.
- Sets upload filters (allow .csv/.xls/.xlsx/images) and proxies/serves frontend when built.
- Mounts routers via `backend/routes.ts`.

backend/routes.ts (Router mounting)
- Central place that mounts feature routers under `/api/*` (orders, inventory, invoices, reports, returns, catalog, public catalog, public orders, employee, billing-details).
- Applies auth/role guards where required.

backend/db.ts (Database pool)
- Configures and exports a PostgreSQL connection pool.
- Shared by services and queries to run transactions and prepared statements.

backend/middleware/auth.ts
- `authenticateUser`: resolves Phantom JWT from `Authorization: Bearer` or session, caches user for 5 min, attaches `req.user`.
- `requireSession`, `requireAdmin`, `requireAdminOrManager`: guards.

backend/middleware/cache.ts
- `cacheMiddleware(ttl)`: caches GET responses per user+URL.
- `invalidateUserCache(userId)`: clears user-related caches after mutations.

backend/middleware/csrf-protection.ts
- Validates `x-csrf-token` per session; utility endpoint to fetch token.

backend/middleware/rate-limit.ts
- Multiple limiters: `apiLimiter`, `authLimiter`, `uploadLimiter`, `orderLimiter`, `publicOrderLimiter`.

backend/utils/query-builder.ts
- Helpers to build dynamic SQL with safe identifiers, pagination, filters.

backend/utils/secure-query.ts
- Parameterized query helpers; prevents SQL injection; wraps pg client with typed methods.

backend/utils/response-optimizer.ts
- Shapes payloads for minimal over-the-wire size; trims unused fields.

backend/utils/s3-config.ts
- Configures S3 client; used by product images endpoints.

backend/utils/indexes.sql + run-optimizations.sql
- SQL to create indexes and optimize query plans.

backend/utils/batch-processor.ts
- Generic batching utility; emits `csv-upload-progress` for long-running processes.

---

## Deep-dive: Orders module (controllers, services, queries)

This section documents the most important endpoints and services in the Orders module with step-by-step execution and data flow.

### Orders module – Additional route commentary

- File: <mcfile name="orders.ts" path="F:\EZPZ-V3 server\backend\orders.ts"></mcfile>
  - POST "/add-manual" at line 175 – manual order creation
    - Resolve current user and merchant context; guard via role checks when applicable.
    - BEGIN transaction; delegate to service <mcsymbol name="createManualOrder" filename="orderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\orderService.ts" startline="14" type="function"></mcsymbol> which validates customer and product, creates order + items, and updates stock.
    - Emit "orderCreated" with newly created order metadata; COMMIT; invalidate user cache; respond 201 with order payload.
    - On error, ROLLBACK, log, and respond 500.

  - POST "/" at line 241 – bulk order creation (single order payload)
    - Parse order body and validate quantity via middleware; resolve merchantId from session.
    - BEGIN; call <mcsymbol name="createBulkOrder" filename="bulkOrderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\bulkOrderService.ts" startline="25" type="function"></mcsymbol> to create order and its items atomically.
    - Emit "orderCreated"; COMMIT; invalidate cache; return the created order.
    - Handle failures with ROLLBACK and error response.

  - POST "/upload-csv" at line 320 – CSV order upload
    - Validate file presence; derive uploadId (from body or generated) and resolve merchantId from session.
    - Parse file buffer via <mcsymbol name="parseCSVOrders" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="29" type="function"></mcsymbol>; return orders[] and parseErrors[].
    - BEGIN; batch process via <mcsymbol name="processCSVUpload" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="230" type="function"></mcsymbol> with uploadId for progress tracking; COMMIT.
    - Invalidate user cache; respond summary including created count, error details, and batch metadata.
    - On error: ROLLBACK; emit error progress via <mcsymbol name="emitErrorProgress" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="408" type="function"></mcsymbol>.

  - POST "/create-sample" at line 422 – sample data generator
    - Creates sample Customer, Product, Inventory, Order, and Order Item records within a transaction for local testing/dev.
    - Uses customer queries like <mcsymbol name="createCustomer" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="83" type="function"></mcsymbol> and product queries like <mcsymbol name="createProduct" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="79" type="function"></mcsymbol>, then links inventory via <mcsymbol name="getInventoryIdForProduct" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="97" type="function"></mcsymbol>.
    - Inserts order and items and decrements inventory; COMMIT and return summary.

  - GET "/debug" at line 520 – development diagnostics
    - Returns current user info, counts for total/assigned orders, product samples, and session snapshot.
    - References employee queries like <mcsymbol name="getAssignedOrders" filename="employee-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\employee-queries.ts" startline="76" type="function"></mcsymbol>.

  - PATCH "/:id/price" at line 620 – update order item prices (admin)
    - Parse order id and an array of { itemId, newPrice } changes.
    - BEGIN; delegate recalculation to <mcsymbol name="updateOrderPrices" filename="orderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\orderService.ts" startline="166" type="function"></mcsymbol> which updates item prices and totals.
    - COMMIT; invalidate cache; respond with new totals; emit optional "order-price-updated" event.

  - PATCH "/:id/payment" at line 710 – payment status update
    - Parse path id and body { status, paymentMethod, amount, pricePerUnit? }.
    - BEGIN; call <mcsymbol name="updatePaymentStatus" filename="paymentService.ts" path="F:\EZPZ-V3 server\backend\orders\services\paymentService.ts" startline="20" type="function"></mcsymbol> which validates and updates payment, optionally adjusts price-per-unit and totals.
    - Emits "order-status-updated"; if invoice created downstream, also emits "invoice-auto-created".
    - COMMIT; invalidate cache; respond with payment and total changes.

  - POST "/assign" at line 802 – assign order to employee (admin)
    - Validate admin role; parse { orderId, userId }.
    - BEGIN; call <mcsymbol name="assignOrderToEmployee" filename="assignmentService.ts" path="F:\EZPZ-V3 server\backend\orders\services\assignmentService.ts" startline="9" type="function"></mcsymbol> to set assignment and emit an assignment event.
    - COMMIT; invalidate cache; respond with assignment confirmation.

  - PATCH "/:id/status" at line 852 – order status update
    - Parse new status and validate allowed transition for current state.
    - BEGIN; invoke <mcsymbol name="updateOrderStatus" filename="statusService.ts" path="F:\EZPZ-V3 server\backend\orders\services\statusService.ts" startline="10" type="function"></mcsymbol> which enforces rules (e.g., cannot ship unpaid), writes status history, and emits "order-status-updated".
    - COMMIT; invalidate cache; respond with updated status.

  - POST "/return" at line 900 – create return request
    - Validate input; ensure order exists via <mcsymbol name="checkOrderExists" filename="order-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-queries.ts" startline="194" type="function"></mcsymbol>.
    - BEGIN; call <mcsymbol name="createReturnRequest" filename="returnService.ts" path="F:\EZPZ-V3 server\backend\orders\services\returnService.ts" startline="18" type="function"></mcsymbol> to persist request, adjust stock if applicable, and emit "return-request-created".
    - COMMIT; invalidate cache; respond with return details.

### Orders services – Line-by-line commentary and query cross-references

- File: <mcfile name="orderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\orderService.ts"></mcfile>
  - <mcsymbol name="createManualOrder" filename="orderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\orderService.ts" startline="14" type="function"></mcsymbol>
    - Validates payload, resolves or creates Customer using <mcsymbol name="findCustomerByPhone" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="6" type="function"></mcsymbol>, <mcsymbol name="updateCustomerDetails" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="19" type="function"></mcsymbol>, and <mcsymbol name="createCustomer" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="83" type="function"></mcsymbol>.
    - Validates Product and Inventory via <mcsymbol name="findProductByName" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="20" type="function"></mcsymbol> and <mcsymbol name="getInventoryIdForProduct" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="97" type="function"></mcsymbol>.
    - Creates order items using <mcsymbol name="createOrderItem" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="65" type="function"></mcsymbol>, updates item prices/totals via <mcsymbol name="calculateOrderTotal" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="35" type="function"></mcsymbol> and <mcsymbol name="updateOrderTotal" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="48" type="function"></mcsymbol>.
    - Decrements inventory via <mcsymbol name="updateInventoryQuantity" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="47" type="function"></mcsymbol>; writes status history.

  - <mcsymbol name="updateOrderPrices" filename="orderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\orderService.ts" startline="166" type="function"></mcsymbol>
    - Updates specified item prices via <mcsymbol name="updateOrderItemPrices" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="19" type="function"></mcsymbol>, recalculates totals with <mcsymbol name="calculateOrderTotal" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="35" type="function"></mcsymbol>, persists via <mcsymbol name="updateOrderTotal" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="48" type="function"></mcsymbol>.

- File: <mcfile name="paymentService.ts" path="F:\EZPZ-V3 server\backend\orders\services\paymentService.ts"></mcfile>
  - <mcsymbol name="updatePaymentStatus" filename="paymentService.ts" path="F:\EZPZ-V3 server\backend\orders\services\paymentService.ts" startline="20" type="function"></mcsymbol>
    - Checks existing payment with <mcsymbol name="checkPaymentExists" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="6" type="function"></mcsymbol>; updates or creates via <mcsymbol name="updatePayment" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="19" type="function"></mcsymbol> and <mcsymbol name="createPayment" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="37" type="function"></mcsymbol>.
    - Persists order-level payment status via <mcsymbol name="updateOrderPaymentStatus" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="54" type="function"></mcsymbol> and fetches canonical status via <mcsymbol name="getPaymentStatus" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="81" type="function"></mcsymbol>.
    - When marked paid, may adjust prices through <mcsymbol name="updateOrderPrices" filename="orderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\orderService.ts" startline="166" type="function"></mcsymbol> and auto-create an invoice via <mcsymbol name="createInvoiceFromPaidOrder" filename="invoiceService.ts" path="F:\EZPZ-V3 server\backend\orders\services\invoiceService.ts" startline="11" type="function"></mcsymbol>.

- File: <mcfile name="statusService.ts" path="F:\EZPZ-V3 server\backend\orders\services\statusService.ts"></mcfile>
  - <mcsymbol name="updateOrderStatus" filename="statusService.ts" path="F:\EZPZ-V3 server\backend\orders\services\statusService.ts" startline="10" type="function"></mcsymbol>
    - Validates target transition vs current state using <mcsymbol name="getOrderStatus" filename="order-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-queries.ts" startline="207" type="function"></mcsymbol>.
    - Enforces business rules (e.g., cannot move to confirmed/shipped if unpaid), updates status, and appends status history within the transaction.

- File: <mcfile name="bulkOrderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\bulkOrderService.ts"></mcfile>
  - <mcsymbol name="createBulkOrder" filename="bulkOrderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\bulkOrderService.ts" startline="25" type="function"></mcsymbol>
    - Normalizes payload, resolves/creates customer via customer queries, validates products and inventory availability, inserts order header and items, updates inventory, and writes initial status history.

- File: <mcfile name="assignmentService.ts" path="F:\EZPZ-V3 server\backend\orders\services\assignmentService.ts"></mcfile>
  - <mcsymbol name="assignOrderToEmployee" filename="assignmentService.ts" path="F:\EZPZ-V3 server\backend\orders\services\assignmentService.ts" startline="9" type="function"></mcsymbol>
    - Assigns order to a user via <mcsymbol name="assignOrderToUser" filename="employee-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\employee-queries.ts" startline="45" type="function"></mcsymbol>; may enforce role checks and emit "order-assigned".

- File: <mcfile name="invoiceService.ts" path="F:\EZPZ-V3 server\backend\orders\services\invoiceService.ts"></mcfile>
  - <mcsymbol name="createInvoiceFromPaidOrder" filename="invoiceService.ts" path="F:\EZPZ-V3 server\backend\orders\services\invoiceService.ts" startline="11" type="function"></mcsymbol>
    - Fetches merchant billing profile via <mcsymbol name="getMerchantBillingDetails" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="6" type="function"></mcsymbol> and order items with GST via <mcsymbol name="getOrderItemsWithGst" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="33" type="function"></mcsymbol>.
    - Reserves next invoice number via <mcsymbol name="updateNextInvoiceNumber" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="19" type="function"></mcsymbol>, inserts header with <mcsymbol name="createInvoiceHeader" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="48" type="function"></mcsymbol>, and items via <mcsymbol name="insertInvoiceItem" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="92" type="function"></mcsymbol>.
    - Avoids duplicates by checking <mcsymbol name="checkInvoiceExists" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="135" type="function"></mcsymbol>.

- File: <mcfile name="returnService.ts" path="F:\EZPZ-V3 server\backend\orders\services\returnService.ts"></mcfile>
  - <mcsymbol name="createReturnRequest" filename="returnService.ts" path="F:\EZPZ-V3 server\backend\orders\services\returnService.ts" startline="18" type="function"></mcsymbol>
    - Validates order existence via <mcsymbol name="checkOrderExists" filename="order-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-queries.ts" startline="194" type="function"></mcsymbol>, records the return request, appends status history, and adjusts stock when items are returned using <mcsymbol name="updateInventoryQuantity" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="47" type="function"></mcsymbol>.

- File: <mcfile name="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts"></mcfile>
  - Cross-referenced queries used within batching:
    - Products validation via <mcsymbol name="batchValidateProducts" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="64" type="function"></mcsymbol>
    - Customers resolution via <mcsymbol name="findCustomersByPhones" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="136" type="function"></mcsymbol> and <mcsymbol name="batchCreateCustomers" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="149" type="function"></mcsymbol>
    - Order items batching via <mcsymbol name="batchCreateOrderItems" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="88" type="function"></mcsymbol>
    - Inventory decrements via <mcsymbol name="updateInventoryQuantity" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="47" type="function"></mcsymbol>

- File: <mcfile name="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts"></mcfile>
  - <mcsymbol name="parseCSVOrders" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="29" type="function"></mcsymbol>
    - Parses Order CSV buffer into normalized rows (customer name/phone, product name/sku, quantity, unit price); trims values, validates required fields, and accumulates parse errors for malformed rows.
  - <mcsymbol name="processOrderBatch" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="71" type="function"></mcsymbol>
    - Validates products via <mcsymbol name="batchValidateProducts" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="64" type="function"></mcsymbol>; resolves customers via <mcsymbol name="findCustomersByPhones" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="136" type="function"></mcsymbol> and creates missing via <mcsymbol name="batchCreateCustomers" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="149" type="function"></mcsymbol>.
    - Inserts items in bulk using <mcsymbol name="batchCreateOrderItems" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="88" type="function"></mcsymbol> and decrements inventory via <mcsymbol name="updateInventoryQuantity" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="47" type="function"></mcsymbol>.
    - Emits 'csv-upload-progress' per batch via backend/utils/batch-processor.
  - <mcsymbol name="processCSVUpload" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="230" type="function"></mcsymbol>
    - Orchestrates the entire CSV upload: splits rows into batches; opens transaction per batch; delegates to processOrderBatch; tracks uploadId progress and totals; commits on success.
    - On error, rolls back and reports via <mcsymbol name="emitErrorProgress" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="408" type="function"></mcsymbol>.
  - <mcsymbol name="emitErrorProgress" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="408" type="function"></mcsymbol>
    - Emits 'csv-upload-progress' with status=error and descriptive message to inform the frontend.

### Orders queries – Function index and semantics

- File: <mcfile name="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts"></mcfile>
  - <mcsymbol name="findCustomerByPhone" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="6" type="function"></mcsymbol> – fetches customer by phone, used to deduplicate or update records
  - <mcsymbol name="updateCustomerDetails" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="19" type="function"></mcsymbol> – updates name/address when an existing customer is found
  - <mcsymbol name="createCustomer" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="83" type="function"></mcsymbol> – inserts a new customer
  - <mcsymbol name="findCustomersByPhones" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="136" type="function"></mcsymbol> – bulk lookup for CSV batches
  - <mcsymbol name="batchCreateCustomers" filename="customer-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\customer-queries.ts" startline="149" type="function"></mcsymbol> – bulk insert for missing customers

- File: <mcfile name="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts"></mcfile>
  - <mcsymbol name="findProductByName" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="20" type="function"></mcsymbol> – resolves product by name
  - <mcsymbol name="updateInventoryQuantity" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="47" type="function"></mcsymbol> – decrements or increments stock
  - <mcsymbol name="batchValidateProducts" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="64" type="function"></mcsymbol> – validates products in bulk for CSV
  - <mcsymbol name="createProduct" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="79" type="function"></mcsymbol> – creates product (used in sample data)
  - <mcsymbol name="getInventoryIdForProduct" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\product-queries.ts" startline="97" type="function"></mcsymbol> – links product to inventory id

- File: <mcfile name="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts"></mcfile>
  - <mcsymbol name="updateOrderItemPrices" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="19" type="function"></mcsymbol> – updates item-level prices
  - <mcsymbol name="calculateOrderTotal" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="35" type="function"></mcsymbol> – aggregates item totals
  - <mcsymbol name="updateOrderTotal" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="48" type="function"></mcsymbol> – persists recalculated order total
  - <mcsymbol name="createOrderItem" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="65" type="function"></mcsymbol> – inserts a single order item
  - <mcsymbol name="batchCreateOrderItems" filename="order-item-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-item-queries.ts" startline="88" type="function"></mcsymbol> – inserts items in bulk (CSV)

- File: <mcfile name="order-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-queries.ts"></mcfile>
  - <mcsymbol name="checkOrderExists" filename="order-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-queries.ts" startline="194" type="function"></mcsymbol> – confirms order id exists prior to returns
  - <mcsymbol name="getOrderStatus" filename="order-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\order-queries.ts" startline="207" type="function"></mcsymbol> – fetches current status for transition validation

- File: <mcfile name="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts"></mcfile>
  - <mcsymbol name="checkPaymentExists" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="6" type="function"></mcsymbol> – determines whether to update vs insert
  - <mcsymbol name="updatePayment" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="19" type="function"></mcsymbol> – updates existing payment record
  - <mcsymbol name="createPayment" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="37" type="function"></mcsymbol> – inserts a new payment record
  - <mcsymbol name="updateOrderPaymentStatus" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="54" type="function"></mcsymbol> – persists order-level payment status
  - <mcsymbol name="getPaymentStatus" filename="payment-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\payment-queries.ts" startline="81" type="function"></mcsymbol> – canonical payment status fetch

- File: <mcfile name="employee-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\employee-queries.ts"></mcfile>
  - <mcsymbol name="assignOrderToUser" filename="employee-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\employee-queries.ts" startline="45" type="function"></mcsymbol> – sets assignment mapping
  - <mcsymbol name="getAssignedOrders" filename="employee-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\employee-queries.ts" startline="76" type="function"></mcsymbol> – fetches assigned orders list

- File: <mcfile name="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts"></mcfile>
  - <mcsymbol name="getMerchantBillingDetails" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="6" type="function"></mcsymbol> – loads merchant billing profile
  - <mcsymbol name="updateNextInvoiceNumber" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="19" type="function"></mcsymbol> – increments invoice sequence
  - <mcsymbol name="getOrderItemsWithGst" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="33" type="function"></mcsymbol> – returns order items with tax data
  - <mcsymbol name="createInvoiceHeader" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="48" type="function"></mcsymbol> – inserts invoice header
  - <mcsymbol name="insertInvoiceItem" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="92" type="function"></mcsymbol> – inserts invoice line item
  - <mcsymbol name="checkInvoiceExists" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\orders\queries\invoice-queries.ts" startline="135" type="function"></mcsymbol> – prevents duplicates

### Cross-references and emits (Orders)

- Emits
  - orderCreated: emitted after successful creation in POST "/add-manual" and POST "/" by services <mcsymbol name="createManualOrder" filename="orderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\orderService.ts" startline="14" type="function"></mcsymbol> and <mcsymbol name="createBulkOrder" filename="bulkOrderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\bulkOrderService.ts" startline="25" type="function"></mcsymbol>.
  - csv-upload-progress: streamed during batch processing in <mcsymbol name="processOrderBatch" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="71" type="function"></mcsymbol> and orchestrated in <mcsymbol name="processCSVUpload" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="230" type="function"></mcsymbol>; errors reported via <mcsymbol name="emitErrorProgress" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\orders\services\csvService.ts" startline="408" type="function"></mcsymbol>.
  - order-status-updated: emitted on status changes via <mcsymbol name="updateOrderStatus" filename="statusService.ts" path="F:\EZPZ-V3 server\backend\orders\services\statusService.ts" startline="10" type="function"></mcsymbol> and also when payment transitions impact status via <mcsymbol name="updatePaymentStatus" filename="paymentService.ts" path="F:\EZPZ-V3 server\backend\orders\services\paymentService.ts" startline="20" type="function"></mcsymbol>.
  - invoice-auto-created: emitted when an invoice is generated for a paid order by <mcsymbol name="createInvoiceFromPaidOrder" filename="invoiceService.ts" path="F:\EZPZ-V3 server\backend\orders\services\invoiceService.ts" startline="11" type="function"></mcsymbol>.
  - order-assigned: emitted after assignment in <mcsymbol name="assignOrderToEmployee" filename="assignmentService.ts" path="F:\EZPZ-V3 server\backend\orders\services\assignmentService.ts" startline="9" type="function"></mcsymbol>.
  - order-price-updated: optionally emitted by <mcsymbol name="updateOrderPrices" filename="orderService.ts" path="F:\EZPZ-V3 server\backend\orders\services\orderService.ts" startline="166" type="function"></mcsymbol> when recalculating item prices and totals.
  - return-request-created: emitted when a return is created by <mcsymbol name="createReturnRequest" filename="returnService.ts" path="F:\EZPZ-V3 server\backend\orders\services\returnService.ts" startline="18" type="function"></mcsymbol>.

- Validations and middleware
  - Auth: routes mounted via <mcfile name="routes.ts" path="F:\EZPZ-V3 server\backend\routes.ts"></mcfile> apply `authenticateUser`; admin/manager guards protect assignment, price updates, and certain status changes.
  - Rate limiting: `orderLimiter` applies to high-traffic order endpoints to prevent abuse.
  - Upload limits: `uploadLimiter` and file-type validation protect the CSV upload endpoint.
  - CSRF: mutating endpoints honor CSRF protections where sessions are used.
  - Cache: `invalidateUserCache(userId)` runs after successful mutations to keep user-facing lists fresh.

- Frontend consumption
  - The `csv-upload-progress` stream is received by the frontend WebSocket layer in <mcfile name="WebSocketContext.tsx" path="F:\EZPZ-V3 server\src\context\WebSocketContext.tsx"></mcfile>, powering upload progress UI.

## Deep-dive: Catalog module (controllers, services, queries)

- File: <mcfile name="product-catalog.ts" path="F:\EZPZ-V3 server\backend\product-catalog.ts"></mcfile>
  - GET "/categories" at line 44 – list categories for the current merchant; delegates to category query builder.
  - GET "/products" at line 76 – list products with filters/pagination; uses query builder <mcsymbol name="buildProductListQuery" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="57" type="function"></mcsymbol>.
  - GET "/products/:id" at line 154 – product detail; uses <mcsymbol name="buildSingleProductQuery" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="179" type="function"></mcsymbol> and transforms with <mcsymbol name="transformProduct" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="274" type="function"></mcsymbol>.
  - POST "/products" at line 200 – create product; delegates to service <mcsymbol name="createProductService" filename="productService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\productService.ts" startline="32" type="function"></mcsymbol>; validates duplicates via <mcsymbol name="checkDuplicateSku" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="314" type="function"></mcsymbol>; optionally creates inventory entry via <mcsymbol name="createInventoryEntry" filename="inventoryIntegrationService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\inventoryIntegrationService.ts" startline="12" type="function"></mcsymbol>.
  - PUT "/products/:id" at line 252 – update product; uses <mcsymbol name="updateProductService" filename="productService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\productService.ts" startline="178" type="function"></mcsymbol> and may update inventory via <mcsymbol name="updateInventoryEntry" filename="inventoryIntegrationService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\inventoryIntegrationService.ts" startline="46" type="function"></mcsymbol>.
  - DELETE "/products/:id" at line 294 – delete product; uses <mcsymbol name="deleteProductService" filename="productService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\productService.ts" startline="343" type="function"></mcsymbol>.
  - POST "/products/:id/images" at line 335 – upload image; uses <mcsymbol name="uploadImageService" filename="imageService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\imageService.ts" startline="21" type="function"></mcsymbol>.
  - DELETE "/products/:productId/images/:catalogueId" at line 390 – delete image; uses <mcsymbol name="deleteImageService" filename="imageService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\imageService.ts" startline="85" type="function"></mcsymbol>.
  - PUT "/products/:productId/images/:catalogueId/set-primary" at line 430 – set primary image; uses <mcsymbol name="setPrimaryImageService" filename="imageService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\imageService.ts" startline="130" type="function"></mcsymbol>.
  - GET "/tags" at line 470 – list tags; uses <mcsymbol name="getTagsQuery" filename="tag-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\tag-queries.ts" startline="5" type="function"></mcsymbol>.
  - PUT "/products/:id/tags" at line 504 – update product tags; uses <mcsymbol name="updateProductTagsService" filename="tagService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\tagService.ts" startline="4" type="function"></mcsymbol>.

- Services
  - <mcfile name="productService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\productService.ts"></mcfile>
    - <mcsymbol name="createProductService" filename="productService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\productService.ts" startline="32" type="function"></mcsymbol> – create product and integrate with inventory if needed.
    - <mcsymbol name="updateProductService" filename="productService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\productService.ts" startline="178" type="function"></mcsymbol> – update product details and tags.
    - <mcsymbol name="deleteProductService" filename="productService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\productService.ts" startline="343" type="function"></mcsymbol> – delete product and clean related images.
  - <mcfile name="imageService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\imageService.ts"></mcfile>
    - <mcsymbol name="uploadImageService" filename="imageService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\imageService.ts" startline="21" type="function"></mcsymbol>, <mcsymbol name="deleteImageService" filename="imageService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\imageService.ts" startline="85" type="function"></mcsymbol>, <mcsymbol name="setPrimaryImageService" filename="imageService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\imageService.ts" startline="130" type="function"></mcsymbol> – manage product images.
  - <mcfile name="tagService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\tagService.ts"></mcfile>
    - <mcsymbol name="updateProductTagsService" filename="tagService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\tagService.ts" startline="4" type="function"></mcsymbol> – update product tags.
  - <mcfile name="inventoryIntegrationService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\inventoryIntegrationService.ts"></mcfile>
    - <mcsymbol name="createInventoryEntry" filename="inventoryIntegrationService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\inventoryIntegrationService.ts" startline="12" type="function"></mcsymbol>, <mcsymbol name="updateInventoryEntry" filename="inventoryIntegrationService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\inventoryIntegrationService.ts" startline="46" type="function"></mcsymbol>, <mcsymbol name="inventoryEntryExists" filename="inventoryIntegrationService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\inventoryIntegrationService.ts" startline="98" type="function"></mcsymbol> – inventory integration helpers.

- Queries
  - <mcfile name="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts"></mcfile>
    - <mcsymbol name="buildProductListQuery" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="57" type="function"></mcsymbol>, <mcsymbol name="buildSingleProductQuery" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="179" type="function"></mcsymbol>, <mcsymbol name="transformProduct" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="274" type="function"></mcsymbol>, <mcsymbol name="checkDuplicateSku" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="314" type="function"></mcsymbol>.
  - <mcfile name="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts"></mcfile>
    - <mcsymbol name="verifyProductOwnership" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="4" type="function"></mcsymbol>, <mcsymbol name="getImageDetails" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="17" type="function"></mcsymbol>, <mcsymbol name="checkImageIsPrimary" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="30" type="function"></mcsymbol>, <mcsymbol name="getFirstRemainingImage" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="43" type="function"></mcsymbol>, <mcsymbol name="verifyImageOwnership" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="58" type="function"></mcsymbol>.
  - <mcfile name="tag-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\tag-queries.ts"></mcfile>
    - <mcsymbol name="getTagsQuery" filename="tag-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\tag-queries.ts" startline="5" type="function"></mcsymbol>.
  - <mcfile name="category-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\category-queries.ts"></mcfile>
    - <mcsymbol name="getCategoriesQuery" filename="category-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\category-queries.ts" startline="4" type="function"></mcsymbol>.

## Deep-dive: Public Catalog module (controllers)

- File: <mcfile name="public-catalog.ts" path="F:\EZPZ-V3 server\backend\public-catalog.ts"></mcfile>
  - GET "/merchant/:merchantId" at line 15 – merchant profile/public info.
  - GET "/merchant/:merchantId/products" at line 27 – list merchant products.
  - GET "/merchant/:merchantId/products/:productId" at line 54 – product details.
  - GET "/merchant/:merchantId/categories" at line 71 – categories for public storefront.

## Deep-dive: Public Orders module (controllers, services, emits)

- File: <mcfile name="public-orders.ts" path="F:\EZPZ-V3 server\backend\public-orders.ts"></mcfile>
  - POST "/create" at line 16 – create public order; delegates to services:
    - <mcfile name="order-creation-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\order-creation-service.ts"></mcfile>
      - <mcsymbol name="validateMerchant" filename="order-creation-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\order-creation-service.ts" startline="49" type="function"></mcsymbol>, <mcsymbol name="findOrCreateCustomer" filename="order-creation-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\order-creation-service.ts" startline="61" type="function"></mcsymbol>, <mcsymbol name="calculateTotalAmount" filename="order-creation-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\order-creation-service.ts" startline="121" type="function"></mcsymbol>, <mcsymbol name="processOrderItems" filename="order-creation-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\order-creation-service.ts" startline="130" type="function"></mcsymbol>, <mcsymbol name="createPublicOrder" filename="order-creation-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\order-creation-service.ts" startline="190" type="function"></mcsymbol>.
    - <mcfile name="inventory-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\inventory-service.ts"></mcfile>
      - <mcsymbol name="updateInventoryAndNotify" filename="inventory-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\inventory-service.ts" startline="10" type="function"></mcsymbol> – decrements inventory and emits updates.
  - Emits: `inventory-updated`, `inventory-stock-updated` during inventory adjustments.

## Deep-dive: Returns module (controllers, services, emits)

- File: <mcfile name="returns.ts" path="F:\EZPZ-V3 server\backend\returns.ts"></mcfile>
  - GET "/" at line 12 – list return requests.
  - GET "/:returnId" at line 47 – get single return request details.
  - PATCH "/:returnId/status" at line 75 – update single return status.
  - PATCH "/bulk-status" at line 164 – bulk update statuses.

- Services
  - <mcfile name="status-update-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\status-update-service.ts"></mcfile>
    - <mcsymbol name="validateStatusValues" filename="status-update-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\status-update-service.ts" startline="21" type="function"></mcsymbol>, <mcsymbol name="buildStatusUpdateParts" filename="status-update-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\status-update-service.ts" startline="61" type="function"></mcsymbol> – helpers.
    - <mcsymbol name="updateReturnStatus" filename="status-update-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\status-update-service.ts" startline="96" type="function"></mcsymbol>, <mcsymbol name="bulkUpdateReturnStatus" filename="status-update-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\status-update-service.ts" startline="163" type="function"></mcsymbol> – apply updates.
  - <mcfile name="inventory-notification-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\inventory-notification-service.ts"></mcfile>
    - <mcsymbol name="emitInventoryRestockNotification" filename="inventory-notification-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\inventory-notification-service.ts" startline="11" type="function"></mcsymbol>, <mcsymbol name="emitBulkInventoryRestockNotification" filename="inventory-notification-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\inventory-notification-service.ts" startline="135" type="function"></mcsymbol> – emits `inventory-updated` and `inventory-stock-updated` upon returns.

## Deep-dive: Reports module (controllers, services)

- File: <mcfile name="reports.ts" path="F:\EZPZ-V3 server\backend\reports.ts"></mcfile>
  - GET "/" at line 20 – list/report index.
  - GET "/dashboard" at line 57 – dashboard overview via <mcsymbol name="getDashboardMetrics" filename="dashboardService.ts" path="F:\EZPZ-V3 server\backend\reports\services\dashboardService.ts" startline="10" type="function"></mcsymbol>.
  - GET "/kpis" at line 96 – KPIs via <mcsymbol name="calculateKPIs" filename="kpiService.ts" path="F:\EZPZ-V3 server\backend\reports\services\kpiService.ts" startline="10" type="function"></mcsymbol>.
  - GET "/debug-dashboard" at line 128 – debug dashboard.
  - GET "/sales" at line 194 – sales report via <mcsymbol name="getSalesReport" filename="salesService.ts" path="F:\EZPZ-V3 server\backend\reports\services\salesService.ts" startline="10" type="function"></mcsymbol>.
  - GET "/export/sales" at line 229 – export CSV via <mcsymbol name="exportSalesToCSV" filename="exportService.ts" path="F:\EZPZ-V3 server\backend\reports\services\exportService.ts" startline="9" type="function"></mcsymbol>.

- Services
  - <mcfile name="reportService.ts" path="F:\EZPZ-V3 server\backend\reports\services\reportService.ts"></mcfile>
    - <mcsymbol name="generateReport" filename="reportService.ts" path="F:\EZPZ-V3 server\backend\reports\services\reportService.ts" startline="10" type="function"></mcsymbol> – generic report generator used by endpoints.

## Deep-dive: Billing Details module (controllers)

- File: <mcfile name="billing-details.ts" path="F:\EZPZ-V3 server\backend\billing-details.ts"></mcfile>
  - GET "/" at line 9 – fetch merchant billing details profile.
  - POST "/" at line 94 – create/update merchant billing details.

## Deep-dive: Employee module (controllers)

- File: <mcfile name="employee.ts" path="F:\EZPZ-V3 server\backend\employee.ts"></mcfile>
  - GET "/assigned-orders" at line 18 – list orders assigned to the current employee.
  - GET "/orders" at line 35 – list all orders accessible to the employee (role-based).
  - PUT "/orders/:orderId/status" at line 52 – update order status for an assigned order (role guarded).

## Cross-references and emits (Catalog)

- Controller routes delegate to services and queries
  - Product endpoints delegate to <mcfile name="productService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\productService.ts"></mcfile> and query builders in <mcfile name="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts"></mcfile>.
  - Image endpoints delegate to <mcfile name="imageService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\imageService.ts"></mcfile> and cross-check ownership via <mcfile name="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts"></mcfile>.
  - Tag endpoints delegate to <mcfile name="tagService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\tagService.ts"></mcfile> and list queries in <mcfile name="tag-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\tag-queries.ts"></mcfile>.
  - Category list uses <mcfile name="category-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\category-queries.ts"></mcfile>.
- Emits
  - Inventory integration via <mcfile name="inventoryIntegrationService.ts" path="F:\EZPZ-V3 server\backend\product-catalog\services\inventoryIntegrationService.ts"></mcfile> can lead to inventory events emitted in the Inventory module, including `inventory-updated`, `inventory-price-updated`, `inventory-selling-price-updated`, and `inventory-product-added`.
- Validations and middleware
  - Auth guard on merchant-owned resources; SKU duplicate checks via <mcsymbol name="checkDuplicateSku" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="314" type="function"></mcsymbol>; ownership checks via <mcfile name="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts"></mcfile>.

## Cross-references and emits (Public Orders)

- Controller routes delegate to services
  - Order creation delegates to <mcfile name="order-creation-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\order-creation-service.ts"></mcfile> for merchant validation, customer creation, totals, and item processing.
  - Inventory adjustments and emits are handled by <mcfile name="inventory-service.ts" path="F:\EZPZ-V3 server\backend\public-orders\services\inventory-service.ts"></mcfile>.
- Emits
  - `inventory-updated`, `inventory-stock-updated` when public orders adjust stock.
- Validations and middleware
  - Public endpoints validate merchant IDs and item payloads; rate limiting may apply to public order creation.

## Cross-references and emits (Returns)

- Controller routes delegate to services
  - Status changes use <mcfile name="status-update-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\status-update-service.ts"></mcfile> helpers and update functions.
  - Restock notifications use <mcfile name="inventory-notification-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\inventory-notification-service.ts"></mcfile>.
- Emits
  - `inventory-updated` and `inventory-stock-updated` upon accepted returns restocking.
- Validations and middleware
  - Auth guard; input validation for status values via <mcsymbol name="validateStatusValues" filename="status-update-service.ts" path="F:\EZPZ-V3 server\backend\returns\services\status-update-service.ts" startline="21" type="function"></mcsymbol>.

## Cross-references and emits (Reports)

- Controller routes delegate to services
  - Dashboard uses <mcfile name="dashboardService.ts" path="F:\EZPZ-V3 server\backend\reports\services\dashboardService.ts"></mcfile>.
  - Sales uses <mcfile name="salesService.ts" path="F:\EZPZ-V3 server\backend\reports\services\salesService.ts"></mcfile> and CSV export via <mcfile name="exportService.ts" path="F:\EZPZ-V3 server\backend\reports\services\exportService.ts"></mcfile>.
  - Generic report generation via <mcfile name="reportService.ts" path="F:\EZPZ-V3 server\backend\reports\services\reportService.ts"></mcfile>.
- Validations and middleware
  - Auth guard on all report endpoints; potential query parameter validations (date ranges, aggregation).

## Catalog queries – Function index and semantics

- <mcfile name="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts"></mcfile>
  - <mcsymbol name="checkProductColumns" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="21" type="function"></mcsymbol> – probes DB for optional columns and view presence to adjust query composition.
  - <mcsymbol name="buildProductListQuery" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="57" type="function"></mcsymbol> – builds paginated product list with dynamic projections and filters.
  - <mcsymbol name="buildSingleProductQuery" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="137" type="function"></mcsymbol> – builds detailed single product query using view or base tables.
  - <mcsymbol name="transformProduct" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="274" type="function"></mcsymbol> – normalizes product payload to frontend structure.
  - <mcsymbol name="checkDuplicateSku" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\product-queries.ts" startline="314" type="function"></mcsymbol> – checks SKU uniqueness per merchant.
- <mcfile name="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts"></mcfile>
  - <mcsymbol name="verifyProductOwnership" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="3" type="function"></mcsymbol> – verify product belongs to merchant.
  - <mcsymbol name="getImageDetails" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="16" type="function"></mcsymbol> – fetch s3_key for an image.
  - <mcsymbol name="checkImageIsPrimary" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="29" type="function"></mcsymbol> – check if catalogue image is primary.
  - <mcsymbol name="getFirstRemainingImage" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="42" type="function"></mcsymbol> – find next image after deletion for primary reset.
  - <mcsymbol name="verifyImageOwnership" filename="image-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\image-queries.ts" startline="55" type="function"></mcsymbol> – ensure image belongs to product and is active.
- <mcfile name="tag-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\tag-queries.ts"></mcfile>
  - <mcsymbol name="getTagsQuery" filename="tag-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\tag-queries.ts" startline="5" type="function"></mcsymbol> – return SQL and params to list tags with counts, considering column existence.
- <mcfile name="category-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\category-queries.ts"></mcfile>
  - <mcsymbol name="getCategoriesQuery" filename="category-queries.ts" path="F:\EZPZ-V3 server\backend\product-catalog\queries\category-queries.ts" startline="4" type="function"></mcsymbol> – return SQL and params to list categories with counts for a merchant; adapts to optional is_active column presence.

## Deep-dive: Invoices module (controllers, services, queries)

- File: <mcfile name="invoices.ts" path="F:\EZPZ-V3 server\backend\invoices.ts"></mcfile>
  - GET "/" at line 25 – list invoices
  - POST "/add-manual" at line 95 – create manual invoice
  - POST "/upload-csv" at line 197 – upload CSV of invoices, streamed progress via <mcsymbol name="emitProgress" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\csvService.ts" startline="59" type="function"></mcsymbol>
  - GET "/:id/items" at line 279 – list items of invoice
  - PATCH "/:id/status" at line 353 – update invoice status via <mcsymbol name="updateInvoiceStatus" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="147" type="function"></mcsymbol>
  - PATCH "/:id" at line 423 – update invoice details via <mcsymbol name="updateInvoiceDetails" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="177" type="function"></mcsymbol>
  - GET "/:id/download" at line 512 – generate and download invoice PDF via <mcsymbol name="generateInvoicePDF" filename="pdfService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\pdfService.ts" startline="11" type="function"></mcsymbol>

- Services
  - <mcfile name="invoiceService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceService.ts"></mcfile>
    - <mcsymbol name="createInvoiceFromOrder" filename="invoiceService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceService.ts" startline="16" type="function"></mcsymbol> – create invoice from an order, used when orders are marked paid.
  - <mcfile name="invoiceNumberService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceNumberService.ts"></mcfile>
    - <mcsymbol name="generateInvoiceNumber" filename="invoiceNumberService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceNumberService.ts" startline="9" type="function"></mcsymbol> – reserve next invoice number.
  - <mcfile name="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts"></mcfile>
    - <mcsymbol name="validatePaymentStatus" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="19" type="function"></mcsymbol>, <mcsymbol name="validatePaymentMethod" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="31" type="function"></mcsymbol> – validation helpers.
    - <mcsymbol name="getCurrentInvoice" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="40" type="function"></mcsymbol> – load current invoice, used in updates.
    - <mcsymbol name="calculateNewTotalAmount" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="60" type="function"></mcsymbol>, <mcsymbol name="buildUpdateQuery" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="78" type="function"></mcsymbol> – internal helpers to compute and build SQL.
    - <mcsymbol name="updateInvoiceStatus" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="147" type="function"></mcsymbol>, <mcsymbol name="updateInvoiceDetails" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="177" type="function"></mcsymbol> – main mutators.
  - <mcfile name="csvService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\csvService.ts"></mcfile>
    - <mcsymbol name="parseCSVInvoices" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\csvService.ts" startline="21" type="function"></mcsymbol> – parse invoice CSV.
    - <mcsymbol name="emitProgress" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\csvService.ts" startline="59" type="function"></mcsymbol> – emit csv-upload-progress updates.
    - <mcsymbol name="processCSVUpload" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\csvService.ts" startline="87" type="function"></mcsymbol> – orchestrate invoices CSV upload.
  - <mcfile name="pdfService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\pdfService.ts"></mcfile>
    - <mcsymbol name="generateInvoicePDF" filename="pdfService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\pdfService.ts" startline="11" type="function"></mcsymbol> – generate PDF for invoice.

Cross-references and emits (Inventory)
- Controller routes in <mcfile name="inventory.ts" path="F:\EZPZ-V3 server\backend\inventory.ts"></mcfile> delegate to services and queries:
  - Listing: GET "/" → <mcsymbol name="getProductsWithFilters" filename="product-queries.ts" path="F:\EZPZ-V3 server\backend\inventory\queries\product-queries.ts" startline="11" type="function"></mcsymbol>
  - CSV uploads: update-stock-csv → <mcsymbol name="processStockUpdateCSV" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\inventory\services\csvService.ts" startline="63" type="function"></mcsymbol>; upload-csv → <mcsymbol name="processProductCSV" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\inventory\services\csvService.ts" startline="217" type="function"></mcsymbol>
  - Emits:
    - csv-upload-progress: inventory CSV processing progress updates
    - inventory-price-updated, inventory-selling-price-updated: price changes
    - inventory-product-added: manual product addition
    - inventory-stock-updated: manual stock changes
    - inventory-updated: combined product/inventory updates

### Invoices queries – Function index and semantics

- <mcfile name="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-queries.ts"></mcfile>
  - <mcsymbol name="getInvoicesQuery" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-queries.ts" startline="6" type="function"></mcsymbol> – returns a SELECT for listing invoices for a merchant (supports typical filters/pagination).
  - <mcsymbol name="getUserMerchantIdQuery" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-queries.ts" startline="67" type="function"></mcsymbol> – resolve merchantId for the current user.

- <mcfile name="invoice-number-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-number-queries.ts"></mcfile>
  - <mcsymbol name="generateInvoiceNumberQuery" filename="invoice-number-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-number-queries.ts" startline="6" type="function"></mcsymbol> – build an atomic reservation/fetch for the next invoice number.
  - <mcsymbol name="getMerchantBillingDetailsQuery" filename="invoice-number-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-number-queries.ts" startline="21" type="function"></mcsymbol> – fetch merchant billing details for invoice header.

- <mcfile name="invoice-item-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-item-queries.ts"></mcfile>
  - <mcsymbol name="getInvoiceWithItemsQuery" filename="invoice-item-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-item-queries.ts" startline="6" type="function"></mcsymbol> – load invoice rows joined with items.
  - <mcsymbol name="getInvoiceItemsQuery" filename="invoice-item-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-item-queries.ts" startline="26" type="function"></mcsymbol> – list items by invoiceId.
  - <mcsymbol name="getInvoiceForPdfQuery" filename="invoice-item-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-item-queries.ts" startline="41" type="function"></mcsymbol> – gather enriched invoice data for PDF generation.

- <mcfile name="order-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\order-queries.ts"></mcfile>
  - <mcsymbol name="getOrderDetailsQuery" filename="order-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\order-queries.ts" startline="6" type="function"></mcsymbol> – get order header used to create invoice from order.
  - <mcsymbol name="getOrderItemsWithGstQuery" filename="order-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\order-queries.ts" startline="24" type="function"></mcsymbol> – items with GST breakdown for invoice lines.

### Cross-references and emits (Invoices)

- Controller routes in <mcfile name="invoices.ts" path="F:\EZPZ-V3 server\backend\invoices.ts"></mcfile> delegate to services:
  - "/" → list via <mcsymbol name="getInvoicesQuery" filename="invoice-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-queries.ts" startline="6" type="function"></mcsymbol>.
  - "/add-manual" → uses numbering via <mcsymbol name="generateInvoiceNumber" filename="invoiceNumberService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceNumberService.ts" startline="9" type="function"></mcsymbol> and item queries as needed.
  - "/upload-csv" → orchestrated by <mcsymbol name="processCSVUpload" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\csvService.ts" startline="87" type="function"></mcsymbol>, progress via <mcsymbol name="emitProgress" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\csvService.ts" startline="59" type="function"></mcsymbol>.
  - "/:id/items" → reads <mcsymbol name="getInvoiceItemsQuery" filename="invoice-item-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-item-queries.ts" startline="26" type="function"></mcsymbol>.
  - "/:id/status" → <mcsymbol name="updateInvoiceStatus" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="147" type="function"></mcsymbol> with validations.
  - "/:id" → <mcsymbol name="updateInvoiceDetails" filename="invoiceUpdateService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\invoiceUpdateService.ts" startline="177" type="function"></mcsymbol>.
  - "/:id/download" → <mcsymbol name="generateInvoicePDF" filename="pdfService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\pdfService.ts" startline="11" type="function"></mcsymbol>, which consumes <mcsymbol name="getInvoiceForPdfQuery" filename="invoice-item-queries.ts" path="F:\EZPZ-V3 server\backend\invoices\queries\invoice-item-queries.ts" startline="41" type="function"></mcsymbol>.

- Emitted events and frontend consumption
  - CSV uploads: invoices module emits `csv-upload-progress` via <mcsymbol name="emitProgress" filename="csvService.ts" path="F:\EZPZ-V3 server\backend\invoices\services\csvService.ts" startline="59" type="function"></mcsymbol>.
  - The `csv-upload-progress` stream is consumed by frontend WebSocket layer in <mcfile name="WebSocketContext.tsx" path="F:\EZPZ-V3 server\src\context\WebSocketContext.tsx"></mcfile>.

- Validations and middleware
  - Auth: routes mounted via <mcfile name="routes.ts" path="F:\EZPZ-V3 server\backend\routes.ts"></mcfile> apply `authenticateUser`; admin/manager guards protect assignment, price updates, and certain status changes.
  - Rate limiting: `orderLimiter` applies to high-traffic order endpoints to prevent abuse.
  - Upload limits: `uploadLimiter` and file-type validation protect the CSV upload endpoint.
  - CSRF: mutating endpoints honor CSRF protections where sessions are used.
  - Cache: `invalidateUserCache(userId)` runs after successful mutations to keep user-facing lists fresh.

- Frontend consumption
  - The `csv-upload-progress` stream is received by the frontend WebSocket layer in <mcfile name="WebSocketContext.tsx" path="F:\EZPZ-V3 server\src\context\WebSocketContext.tsx"></mcfile>, powering upload progress UI.
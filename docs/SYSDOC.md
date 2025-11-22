# EZPZ-V3 System Documentation (SYSDOC)

## Overview
- Stack: Express/Node backend with PostgreSQL, React/Vite frontend, Socket.IO for real-time updates.
- Auth: Session-based and Phantom JWT tokens supported; role checks for Admin/Manager.
- Real-time: Socket.IO emits updates for orders, inventory, invoices, and CSV uploads.
- Performance: In-memory cache middleware for GET endpoints, response optimizer utilities, and SQL index scripts.

## API Routing Map
Base prefix: `/api`

Mounted routers:
- `/api/auth` – authentication and session utilities.
- `/api/orders` – order management (protected).
- `/api/inventory` – inventory and product updates (protected).
- `/api/reports` – analytics and metrics (protected).
- `/api/invoices` – invoices CRUD, CSV, and downloads (protected).
- `/api/billing-details` – billing details CRUD (protected).
- `/api/returns` – returns and restock (protected).
- `/api/catalog` – internal product catalog (protected).
- `/api/public/catalog` – public catalog browsing (no auth).
- `/api/public/orders` – public order creation (no auth).
- `/api/employee` – employee-specific views (protected).
- `/api/websocket-status` – health endpoint for WebSocket server.

## Endpoints by Module

### Auth (`/api/auth`)
- POST `/register` – register user; enforces password rules.
- POST `/login` – session login; integrates lockout checks.
- GET `/validate-session` – verifies active session.
- POST `/logout` – ends session.
- GET `/user-info` – returns authenticated user info.
- GET `/protected` – protected test endpoint.

### Orders (`/api/orders`)
- GET `/` – list orders; supports pagination; cached for 30s.
- POST `/add-manual` – create manual order; validates quantity.
- POST `/` – standard order creation.
- POST `/upload-csv` – CSV upload; batch processing with WebSocket progress.
- POST `/create-sample` – generate sample orders.
- GET `/debug` – debug info.
- PATCH `/:id/price` – update price.
- PATCH `/:id/payment` – update payment status; emits WebSocket events.
- POST `/assign` – assign orders to employees.
- PATCH `/:id/status` – update order status; emits WebSocket events.
- POST `/return` – create return linked to order.

### Inventory (`/api/inventory`)
- GET `/` – list inventory; pagination; cache(60s).
- POST `/` – create inventory record.
- PUT `/:id` – update product details.
- GET `/low-stock` – low stock report; cache(30s).
- POST `/bulk-update` – bulk inventory update.
- POST `/update-stock-csv` – CSV for stock updates.
- POST `/upload-csv` – CSV pipeline with progress events.
- PATCH `/:id/price` – update unit price; emits WebSocket.
- PATCH `/:id/selling-price` – update selling price; emits WebSocket.
- POST `/add-product` – add product; emits WebSocket.
- PATCH `/:id/stock` – update stock; emits WebSocket.
- PATCH `/:id/update` – general update; emits WebSocket.

### Invoices (`/api/invoices`)
- GET `/` – list invoices.
- POST `/add-manual` – create manual invoice; emits WebSocket.
- POST `/upload-csv` – CSV upload with progress events.
- GET `/:id/items` – list invoice items.
- PATCH `/:id/status` – update invoice status; emits WebSocket.
- PATCH `/:id` – update invoice details; emits WebSocket.
- GET `/:id/download` – download generated invoice file.

### Reports (`/api/reports`)
- GET `/` – basic reports.
- GET `/dashboard` – aggregated dashboard metrics.
- GET `/kpis` – KPIs overview.
- GET `/debug-dashboard` – debug data.
- GET `/sales` – sales report.
- GET `/export/sales` – export sales data.

### Billing Details (`/api/billing-details`)
- GET `/` – read billing details.
- POST `/` – add/update billing details.

### Returns (`/api/returns`)
- GET `/` – list returns.
- GET `/:returnId` – return details.
- PATCH `/:returnId/status` – update single return status.
- PATCH `/bulk-status` – bulk status update; triggers inventory restock events.

### Product Catalog (internal, `/api/catalog`)
- GET `/categories` – list categories.
- GET `/products` – list products with filters.
- GET `/products/:id` – product details.
- POST `/products` – create product (auth required).
- PUT `/products/:id` – update product (auth required).
- DELETE `/products/:id` – delete product (auth required).
- POST `/products/:id/images` – upload image.
- DELETE `/products/:productId/images/:catalogueId` – remove image.
- PUT `/products/:productId/images/:catalogueId/set-primary` – set primary image.
- GET `/tags` – list all tags.
- PUT `/products/:id/tags` – update product tags.

### Public Catalog (`/api/public/catalog`)
- GET `/merchant/:merchantId` – merchant details/public info.
- GET `/merchant/:merchantId/products` – public product list.
- GET `/merchant/:merchantId/products/:productId` – public product detail.
- GET `/merchant/:merchantId/categories` – public categories.

### Public Orders (`/api/public/orders`)
- POST `/create` – create an order (no auth); emits inventory updates.

### Employee (`/api/employee`)
- GET `/assigned-orders` – orders assigned to current employee.
- GET `/orders` – employee orders list.
- PUT `/orders/:orderId/status` – update assigned order status.

## WebSocket Events
Server initializes Socket.IO and exposes `/api/websocket-status` for health.

Emissions (backend):
- `csv-upload-progress` – emitted during CSV processing from orders, inventory, invoices, and batch-processor.
- `orderCreated` – emitted when an order is created.
- `order-status-updated` – emitted when payment/status changes.
- `invoice-auto-created` – emitted when invoice is auto-created from payment.
- `invoice-created` – manual invoice creation.
- `invoice-status-updated` – invoice status changes.
- `invoice-updated` – invoice fields updated.
- `inventory-updated` – generic inventory change.
- `inventory-stock-updated` – stock quantity change.
- `inventory-product-added` – new product added to inventory.
- `inventory-price-updated` – unit price change.
- `inventory-selling-price-updated` – selling price change.
- Connection lifecycle: `welcome`, `connection-test`/`connection-test-response`.

Frontend subscriptions:
- WebSocketProvider establishes connection using `VITE_WS_URL` and listens to `csv-upload-progress` and any events via hooks.
- Hooks: `useWebSocketInventory` (inventory events), `useWebSocketOrders` (order status), `useWebSocketCatalog` (catalog updates).
- Pages using real-time: Dashboard, Orders, Inventory, ProductCatalog, FileUpload modal.

## Security & Middleware
- `authenticateUser` – resolves Phantom token (Authorization: Bearer), falls back to session; caches user for 5 minutes; attaches `req.user`.
- `requireRole` / `requireAdmin` / `requireAdminOrManager` – role-gated access.
- `requireSession` – ensures a session is present.
- `csrfProtection` – validates `x-csrf-token` per session; helper `getCSRFToken` endpoint to fetch token; currently applied selectively.
- `validateSession` – checks session validity and expiry; `refreshSession` extends expiry.
- `sanitizeInput` – strips dangerous characters, prevents XSS in body/query.
- `preventUrlManipulation` – blocks suspicious URL patterns.
- `validatePassword` – enforces complexity on registration.
- `validatePagination` – normalizes `page` and `limit` query.
- `validateQuantity` – ensures non-negative numeric quantity.
- `logSecurityEvents` – logs 4xx/5xx responses with metadata.
- Rate limits: `apiLimiter` (1000/15min), `authLimiter` (100/15min), `uploadLimiter` (10/min), `orderLimiter` (50/min), `publicOrderLimiter` (200/min global).
- Cache: `cacheMiddleware(ttl)` caches GET responses per user and URL; bypasses when `_t` query present or `status=assigned` filter; `invalidateUserCache(userId)` clears user-related cache.

## Data & Utilities
- Database: centralized pool in `backend/db.ts`; SQL schemas and index scripts in `backend/utils/*.sql`.
- JWT/Phantom: helpers in `backend/utils/jwt.ts`.
- Response and query utils: `secure-query.ts`, `query-builder.ts`, `response-optimizer.ts`.
- S3: configuration in `backend/utils/s3-config.ts` with bucket policy and CORS files at repo root.

## CSV Upload Flows
- Orders, Inventory, Invoices each expose `/upload-csv` endpoints that stream/process rows in batches.
- Progress is emitted over `csv-upload-progress` with success/error payloads; frontend `FileUpload` and `ProgressModal` reflect real-time progress.

## Environment & Config
- WebSocket URL configured via `VITE_WS_URL` (see PRE_UPLOAD_CHECKLIST.md).
- Vite/React app served from frontend directory; static hosting configured in backend.

## Testing Real-time
- Visit frontend pages using WebSocket; provider sends `connection-test` on connect and receives `welcome`/`connection-test-response`.
- Health check: GET `/api/websocket-status` returns connected client count and status string.

## Notes
- Internal catalog and all protected routes require `authenticateUser`; public catalog and public orders do not.
- Cache invalidation should be triggered after mutations affecting list endpoints.
- CSV uploads rely on Socket.IO; ensure WebSocket server is reachable before uploads to see live progress.

---

## Repository Directory Tree
A three-level overview of the repository layout to quickly orient developers.

```
EZPZ-V3 server/
├── backend/
│   ├── index.ts
│   ├── db.ts
│   ├── routes.ts
│   ├── orders/ (queries, services, types, utils)
│   ├── inventory/ (queries, services, utils)
│   ├── invoices/ (queries, services)
│   ├── product-catalog/ (queries, services, utils)
│   ├── public-catalog/ (queries, services, types)
│   ├── public-orders/ (queries, services)
│   ├── returns/ (queries, services)
│   ├── reports/ (queries, services, types)
│   ├── middleware/ (auth, cache, csrf, phantom-auth, pool-protection, rate-limit, session-security, validation)
│   ├── utils/ (batch-processor, constants, csrf, jwt, logger, password,
│   │          product-catalog-schema.sql, query-builder, response-optimizer,
│   │          run-optimizations.{js,sql}, s3-config, secure-query, sku, status-validation, validation, indexes.sql)
│   ├── user.model.ts
│   ├── server.js (WhatsApp integration debug)
│   └── billing-details.ts, employee.ts, inventory.ts, invoices.ts, orders.ts, product-catalog.ts, public-catalog.ts, public-orders.ts, returns.ts, reports.ts
├── src/ (frontend)
│   ├── main.tsx, App.tsx, index.css, vite-env.d.ts
│   ├── config/ (api.ts)
│   ├── context/ (AuthContext.tsx, ThemeContext.tsx, WebSocketContext.tsx)
│   ├── hooks/ (useAuthFetch.ts)
│   ├── components/ (..., FileUpload.tsx, ProgressModal.tsx, ProtectedRoute.tsx)
│   ├── pages/ (Dashboard.tsx, Orders.tsx, Inventory.tsx, Invoices.tsx, Returns.tsx,
│   │           ProductCatalog.tsx, PublicCatalog.tsx, Settings.tsx, Login.tsx, Signup.tsx,
│   │           Employee*, Suppliers.tsx, plus section folders)
│   └── utils/ (activityLogger.ts, currency.ts, PublicCartcookies.ts)
├── envfiles/ (.env.example.txt, dev.env/prod.env to be created by you)
├── public/ (static assets)
├── build & tooling: package.json, vite.config.ts, tsconfig*.json, ecosystem.config.cjs, postcss.config.mjs,
│   start-production.mjs, verify-setup.js
├── AWS/S3: S3_BUCKET_POLICY.json, S3_CORS_CONFIGURATION.json
└── Docs: SYSDOC.md, PRE_UPLOAD_CHECKLIST.md, LICENSE
```

---

## Architecture Overview
High-level interaction of subsystems.

- Request Flow
  Route (module router file, e.g., orders.ts) → Middleware (auth, rate-limit, cache, validation) → Handler (in module file acts as controller) → Service (business logic in `backend/*/services`) → Query (SQL in `backend/*/queries`) → Optional: WebSocket emit via `io.emit` → Response JSON

- Authentication Flow
  `authenticateUser` resolves Phantom JWT or session → attaches `req.user` → `requireSession`/`requireAdminOrManager` gate access → CSRF validated for mutative routes when enabled → rate-limit applied.

- Cache Flow
  `cacheMiddleware(ttl)` caches GET responses per-user+URL → bypass via `_t` query or specific filters → `invalidateUserCache(userId)` on mutations (orders/inventory/invoices) to keep lists fresh.

- CSV Upload Flow (batching + progress)
  Upload → CSV parsed (`csv-parser`) → batched processing in service (`processCSVUpload` or `processProductCSV`/`processStockUpdateCSV`) → emits `csv-upload-progress` via global `io` after each batch/error → DB transactions with safe commits/rollbacks → final summary response.

- Inventory Update Flow
  Handler validates payload → service updates product/stock/price → emits `inventory-*` events (updated/stock-updated/price-updated/selling-price-updated/product-added) → caches invalidated → clients refresh.

- Order Status → Invoice Auto-create
  Payment/status patch → service persists changes → when paid, auto-create invoice and emit `invoice-auto-created` → order/invoice events notify clients.

---

## Internal Module Flows (Detailed)

1) Orders
- Create: validate → insert order/items → `orderCreated` emit → invalidate caches.
- Status/Payment: validate status/payment → update → emits `order-status-updated` and maybe `invoice-auto-created`.
- CSV: `/upload-csv` → parse → batch process → progress events → cache invalidation.

2) Inventory
- Stock update: PATCH `/:id/stock` or CSV → service updates quantities → emit `inventory-stock-updated` + `inventory-updated`.
- Price updates: PATCH `/:id/price`/`/:id/selling-price` → emit corresponding events.
- Product add/update: create or update product → emit `inventory-product-added` or `inventory-updated`.

3) Invoices
- Create/Update/Status: handlers → service → emit `invoice-created`/`invoice-status-updated`/`invoice-updated`.
- CSV: parse + batch → progress events.

4) Catalog (internal/public)
- Internal: CRUD on products/images/tags → emits inventory/catalog-related updates where applicable.
- Public: read-only product/category endpoints; public orders reduce stock and emit inventory events.

---

## ASCII Sequence Diagrams

Order Payment → Auto Invoice
```
[PATCH /api/orders/:id/payment]
    ↓ validate + auth
orderService.updatePayment()
    ↓ if payment_status === 'paid'
invoiceService.autoCreateInvoice()
    ↓
io.emit('invoice-auto-created')
    ↓
return 200 JSON
```

Order Creation
```
[POST /api/orders]
    ↓ validate + auth
orderService.create()
    ↓ insert order + items
io.emit('orderCreated')
    ↓ invalidate cache
return 201 JSON
```

CSV Upload (Orders/Inventory/Invoices)
```
[POST /upload-csv]
    ↓ multer parses file
parseCSV(file)
    ↓ batches[N]
processBatch(i)
    ↓ after each batch
io.emit('csv-upload-progress', {i, ok, errors})
    ↓ on error
rollback/continue
    ↓
return 200 summary
```

Inventory Stock Update
```
[PATCH /api/inventory/:id/stock]
    ↓ validate + auth
inventoryService.updateStock()
    ↓
io.emit('inventory-stock-updated')
    ↓
invalidate cache
return 200 JSON
```

Catalog Update (image/tag)
```
[PUT /api/catalog/products/:id/images]
    ↓ validate + auth
catalogService.addImage()
    ↓
S3 putObject
    ↓
return 201 JSON
```

Employee Assignment Flow
```
[POST /api/orders/assign]
    ↓ validate + auth
orderService.assign()
    ↓ update orders
io.emit('order-status-updated')
    ↓
return 200 JSON
```

---

## Per-file Documentation (Key Files)

Backend
- `backend/index.ts` – Express app + Socket.IO bootstrap; file upload filters; global `io` exposure.
- `backend/routes.ts` – mounts module routers under `/api/*`.
- `backend/db.ts` – PostgreSQL pool creation and export.
- `backend/middleware/*` – auth/session/phantom/csrf/cache/rate-limit/validation/pool protection.
- `backend/orders.ts` – orders router: creation, status/payment, assignment, returns, CSV.
- `backend/orders/services/csvService.ts` – parse + batch process CSV orders with `csv-upload-progress` emits.
- `backend/inventory.ts` – inventory router: CRUD, stock/price updates, CSV endpoints.
- `backend/inventory/services/csvService.ts` – product + stock CSV parsing/processing with progress emits.
- `backend/invoices.ts` – invoices router: CRUD, status, CSV, download.
- `backend/invoices/services/csvService.ts` – invoice CSV parsing + batching with progress emits.
- `backend/product-catalog/*` – internal product and media management (queries/services).
- `backend/public-catalog/*` – public product/category queries.
- `backend/public-orders/*` – public order creation and inventory emits.
- `backend/reports/*` – dashboard, sales KPIs, CSV exports.
- `backend/returns/*` – returns listing and status updates; inventory notifications.
- `backend/utils/*` – shared utilities: logging, JWT, query-builder, secure-query, response optimizer, S3 config, SQL schemas/indexes, batch-processor.

Frontend
- `src/main.tsx` – Vite/React entry.
- `src/App.tsx` – routes layout.
- `src/context/AuthContext.tsx` – session user and auth helpers.
- `src/context/WebSocketContext.tsx` – Socket.IO client connection and subscriptions.
- `src/hooks/useAuthFetch.ts` – authenticated fetch with CSRF/session support.
- `src/components/FileUpload.tsx` + `ProgressModal.tsx` – uploads UI; listens to `csv-upload-progress`.
- `src/pages/*` – feature pages (Orders, Inventory, Invoices, Returns, ProductCatalog, PublicCatalog, Dashboard, Employee*, etc.).

---

## Development Guide

Prerequisites
- Node.js 18+
- PostgreSQL reachable; create schemas using `backend/utils/product-catalog-schema.sql` and indexes from `backend/utils/indexes.sql`.
- AWS S3 bucket for product images (see repo JSONs).

Environment
- Create `envfiles/dev.env` and `envfiles/prod.env` with: `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `ALLOWED_ORIGINS`.
- Frontend `.env` in project root: `VITE_API_URL`, `VITE_WS_URL`.

Install
```
npm install
```

Run (Development)
```
npm run dev        # starts backend (tsx watch) and frontend (vite)
```

Build
```
npm run build      # builds frontend and backend
```

Run (Production)
```
npm start          # uses start-production.mjs to start compiled backend
# Or via PM2
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Verify Setup
```
npm run verify
```

WebSockets Manual Test
- Open frontend pages (Dashboard/Orders/Inventory) and watch for `welcome` and `connection-test-response`.
- Health check: GET `/api/websocket-status`.

Cache
- GET endpoints are cached per user; add `_t=<timestamp>` to force-bypass.
- After mutative actions, caches auto-invalidated for affected lists.

SQL Index Scripts
- See `backend/utils/indexes.sql` and `backend/utils/run-optimizations.sql`; apply to DB for performance.

S3 Setup
- Use `S3_BUCKET_POLICY.json` and `S3_CORS_CONFIGURATION.json` to configure bucket; ensure `S3_BUCKET_NAME` and AWS credentials are set in env.
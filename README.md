# Documentation Index

1. [System Architecture](#1-system-architecture-high-level-overview)
2. [Directory Structure Breakdown](#2-directory-structure-breakdown)
3. [Process Flow Documentation](#3-process-flow-documentation)
4. [API Documentation (Full API Table)](#4-api-documentation-full-api-table)
5. [Middleware Documentation](#5-middleware-documentation)
6. [Controller-Level Documentation](#6-controller-level-documentation)
7. [Database Documentation](#7-database-documentation)
8. [Security Documentation](#8-security-documentation)
9. [How Each Important Code Module Works](#9-how-each-important-code-module-works)
10. [Environment Variables](#10-environment-variables-documentation)
11. [Permission Matrix (RBAC)](#11-permission-matrix-rbac-table)
12. [Frontend State Management](#12-frontend-state-management-architecture)
13. [Component Library](#13-component-library-documentation)
14. [Error Handling Strategy](#14-error-handling-strategy)
15. [Logging Format & Structure](#15-logging-format-structure)
16. [Data Validation Strategy](#16-data-validation-strategy)
17. [Backup & Recovery](#17-backup-recovery-procedures)
18. [API Error Codes](#18-api-error-codes-reference)
19. [Sequence Diagrams](#19-sequence-diagrams)
20. [Additional Module Details](#20-additional-module-details)
21. [Glossary / Domain Definitions](#21-glossary--domain-definitions)
22. [Module Dependency Diagram](#22-module-dependency-diagram)
23. [CSV Upload Sequence](#23-csv-upload-sequence)
24. [State Machine Diagrams](#24-state-machine-diagrams)
25. [Frontend Component Map](#25-frontend-component-map)
26. [Frontend Build & Performance](#26-frontend-build--performance)
27. [Design System & UX Guidelines](#27-design-system--ux-guidelines)
28. [Testing Setup & Strategy](#28-testing-setup--strategy)
29. [Deployment & Build Process](#29-deployment--build-process)
30. [WebSocket Events Documentation](#30-websocket-events-documentation)
31. [Billing Details Module](#31-billing-details-module)

---

## 1. System Architecture (High-Level Overview)
### a] Architecture Diagram

```mermaid
graph TD
    Client[Frontend (React/Vite)] -->|HTTP/REST| LB[Load Balancer/Nginx]
    Client -->|WebSocket| Socket[Socket.IO Server]
    LB --> Server[Backend API (Node.js/Express)]
    Socket --> Server
    
    subgraph Backend Services
        Server --> Auth[Auth Service]
        Server --> Orders[Order Service]
        Server --> Inventory[Inventory Service]
        Server --> Reports[Report Service]
    end
    
    Server -->|Queries| DB[(PostgreSQL Database)]
    Server -->|Cache| MemoryCache[In-Memory Cache]
    Server -->|Uploads| S3[AWS S3 Storage]
    
    Auth -->|Phantom/JWT| Security[Security Layer]
```

### b] Technology Stack

**Frontend:**
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** Wouter
- **State/Data:** React Query, Context API
- **Real-time:** Socket.IO Client
- **UI Components:** Lucide React (Icons), Recharts (Charts)

**Backend:**
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (`pg` driver)
- **Real-time:** Socket.IO Server
- **File Handling:** Multer (Memory Storage)
- **PDF Generation:** PDFKit, jsPDF

**Security:**
- **Authentication:** Session-based + Phantom Token (JWT)
- **Hashing:** Argon2
- **Protection:** Helmet, Rate Limiting, CSRF Protection (selective)

**Third Party Services:**
- **Storage:** AWS S3 (for product images/catalog)
- **Logging:** Custom Logger (Winston-like)

---

## 2. Directory Structure Breakdown

### Backend (`backend/`)

| Directory | Description |
|-----------|-------------|
| `controllers/` | *Note: Feature-based structure used instead of central controllers.* |
| `middleware/` | Global middleware (Auth, Rate Limit, Validation, Cache). |
| `user.model.ts` | User database model and authentication functions (located in backend root). |
| `utils/` | Helper functions (JWT, Logger, S3 Config, Query Builder). |
| `types/` | TypeScript type definitions (express-session, global types). |
| `routes.ts` | Main API route aggregator. |
| `db.ts` | Database connection pool configuration. |
| `index.ts` | Application entry point and server configuration. |
| `orders/` | **Order Module:** Queries, Services, and Logic for order management. |
| `inventory/` | **Inventory Module:** Stock management, product updates. |
| `invoices/` | **Invoice Module:** Invoice generation and management. |
| `reports/` | **Reports Module:** Analytics and KPI data. |
| `returns/` | **Returns Module:** Return request management with automatic inventory restocking. |
| `employee/` | **Employee Module:** Employee-specific order operations and assignments. |
| `product-catalog/` | **Catalog Module:** Internal product management (authenticated). |
| `public-catalog/` | **Public Catalog Module:** Public product browsing (no authentication). |
| `public-orders/` | **Public Orders Module:** Public order creation from catalog. |

### Frontend (`src/`)

| Directory | Description |
|-----------|-------------|
| `components/` | Reusable UI components (Sidebar, FileUpload, Modals). |
| `pages/` | Application views/routes (Dashboard, Orders, Login). |
| `hooks/` | Custom React hooks (e.g., `useAuthFetch`, `useWebSocket`). |
| `context/` | Global state providers (Auth, Theme, WebSocket). |
| `utils/` | Frontend helper functions (Formatting, Validation). |
| `lib/` | Shared utility functions and helpers. |
| `config/` | Configuration constants (API URLs). |
| `App.tsx` | Main application component and routing logic. |

---

## 3. Process Flow Documentation

### a] Login / Authentication Flow

1.  **User Input**: User submits Email/Phone and Password.
2.  **Validation**: Backend validates input format.
3.  **Verification**: `argon2` verifies password hash against DB.
4.  **Session Creation**: Express Session created (`req.session.userId`).
5.  **Token Generation**: Phantom Token (opaque string) generated, mapped to JWT.
6.  **Response**: Returns User Info + Phantom Token.

```mermaid
sequenceDiagram
    participant User
    participant API
    participant DB
    participant Session
    
    User->>API: POST /api/auth/login
    API->>DB: Find User by Email/Phone
    DB-->>API: User Record (Hash)
    API->>API: Verify Password (Argon2)
    API->>Session: Create Session
    API->>API: Generate Phantom Token pair
    API-->>User: 200 OK { token, user }
```

### b] Order Creation Flow

1.  **Request**: Frontend sends order details (Items, Customer).
2.  **Auth Check**: `authenticateUser` validates session/token.
3.  **Validation**: Check stock levels and pricing.
4.  **Transaction**: Start DB Transaction.
5.  **Insert**: Create Order record -> Create Order Items.
6.  **Update**: Deduct Inventory stock.
7.  **Commit**: Commit DB Transaction.
8.  **Notify**: Emit `orderCreated` via Socket.IO.

### c] Payment Flow

1.  **Update**: Admin updates payment status (`PATCH /api/orders/:id/payment`).
2.  **Logic**: `paymentService` updates status.
3.  **Auto-Invoice**: If status is 'Paid', `invoiceService` automatically generates an invoice.
4.  **Events**: Emits `order-status-updated` and `invoice-auto-created`.

---

## 4. API Documentation (Full API Table)

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| **Auth** | | | | |
| POST | `/api/auth/login` | User login | No | - |
| POST | `/api/auth/register` | User registration | No | - |
| POST | `/api/auth/logout` | End session | Yes | - |
| GET | `/api/auth/user-info` | Get current user details | Yes | - |
| **Orders** | | | | |
| GET | `/api/orders` | List all orders (paginated) | Yes | - |
| POST | `/api/orders` | Create new order | Yes | - |
| POST | `/api/orders/add-manual` | Create manual order | Yes | - |
| PATCH | `/api/orders/:id/status` | Update order status | Yes | Admin |
| PATCH | `/api/orders/:id/payment` | Update payment status | Yes | Admin |
| POST | `/api/orders/assign` | Assign order to employee | Yes | Admin |
| **Inventory** | | | | |
| GET | `/api/inventory` | List inventory items | Yes | - |
| PATCH | `/api/inventory/:id/stock` | Update stock quantity | Yes | Admin |
| POST | `/api/inventory/add-product` | Add new product | Yes | Admin |
| **Invoices** | | | | |
| GET | `/api/invoices` | List invoices | Yes | - |
| GET | `/api/invoices/:id/download` | Download invoice PDF | Yes | - |
| **Returns** | | | | |
| GET | `/api/returns` | List all returns (paginated) | Yes | - |
| GET | `/api/returns/:returnId` | Get single return details | Yes | - |
| PATCH | `/api/returns/:returnId/status` | Update return status (approval/receipt/status) | Yes | Admin/Manager |
| PATCH | `/api/returns/bulk-status` | Bulk update return statuses | Yes | Admin/Manager |
| **Employee** | | | | |
| GET | `/api/employee/assigned-orders` | Get assigned orders (shipped status) | Yes | Employee |
| GET | `/api/employee/orders` | Get all employee orders | Yes | Employee |
| PUT | `/api/employee/orders/:orderId/status` | Update order status | Yes | Employee |
| **Public Catalog** | | | | |
| GET | `/api/public/catalog/merchant/:merchantId` | Get merchant info | No | - |
| GET | `/api/public/catalog/merchant/:merchantId/products` | Browse products (paginated, filterable) | No | - |
| GET | `/api/public/catalog/merchant/:merchantId/products/:productId` | Get single product details | No | - |
| GET | `/api/public/catalog/merchant/:merchantId/categories` | Get product categories | No | - |
| **Public Orders** | | | | |
| POST | `/api/public/orders/create` | Create order from public catalog | No | - |

---

## 5. Middleware Documentation

| Middleware | File | Purpose | Input | Output |
|------------|------|---------|-------|--------|
| **authenticateUser** | `auth.ts` | Authenticates user via Session or Phantom Token. | `req.headers.authorization` or `req.session` | `req.user` populated, or 401 Error. |
| **phantomAuth** | `phantom-auth.ts` | Validates Bearer token specifically. | `Authorization: Bearer <token>` | `req.user` populated. |
| **apiLimiter** | `rate-limit.ts` | General API rate limiting. | Any Request | 429 if > 1000 req/15min. |
| **authLimiter** | `rate-limit.ts` | Strict limiting for auth endpoints. | Login/Register Request | 429 if > 100 req/15min. |
| **uploadLimiter** | `rate-limit.ts` | Limits file upload frequency. | Upload Request | 429 if > 10 uploads/min. |
| **sanitizeInput** | `validation.ts` | Prevents XSS/Injection. | `req.body`, `req.query` | Sanitized strings. |
| **logSecurityEvents** | `validation.ts` | Logs 4xx/5xx errors for security monitoring. | Response Status | Log entry. |

---

## 6. Controller-Level Documentation

### Orders Controller (`backend/orders.ts`)

| Function/Endpoint | Description | Logic |
|-------------------|-------------|-------|
| `GET /` | Fetch orders | Validates pagination, checks cache, queries DB with filters (status, search). |
| `POST /` | Create Order | Validates items, starts transaction, creates order + items, updates inventory, emits WebSocket event. |
| `PATCH /:id/payment` | Update Payment | Updates payment status. If 'paid', triggers `invoiceService.createInvoiceFromPaidOrder`. Emits events. |
| `POST /upload-csv` | Batch CSV Upload | Parses CSV, processes in batches of 500, emits progress via WebSocket, commits successful batches. |

### Auth Controller (`backend/routes.ts`)

| Function/Endpoint | Description | Logic |
|-------------------|-------------|-------|
| `POST /login` | User Login | Verifies credentials, creates session, generates Phantom Token pair. |
| `POST /register` | User Registration | Validates input, hashes password, creates user, creates session & token. |

---

## 7. Database Documentation

### Core Tables

**`users`**
- `user_id` (PK): Unique identifier.
- `merchant_id` (FK): Links to merchant.
- `email`, `password_hash`: Auth credentials.
- `role`: 'admin', 'manager', 'employee'.

**`orders`**
- `order_id` (PK): Unique identifier.
- `merchant_id` (FK): Owner merchant.
- `customer_id` (FK): Customer link.
- `total_amount`: Final order value.
- `status`: 'pending', 'processing', 'completed', 'cancelled'.
- `payment_status`: 'unpaid', 'paid'.

**`order_items`**
- `order_id` (FK): Parent order.
- `product_id` (FK): Product link.
- `quantity`: Number of units.
- `price_per_unit`: Snapshot of price at time of order.

**`inventory`**
- `inventory_id` (PK): Stock record.
- `product_id` (FK): Product link.
- `quantity_available`: Current stock.

### Database Indexes & Optimization
The system uses targeted indexes to optimize common query patterns (defined in `backend/utils/indexes.sql`).

**Key Indexes:**
-   **Orders**: `idx_orders_merchant_id`, `idx_orders_status`, `idx_orders_payment_status`.
-   **Products**: `idx_products_sku`, `idx_products_name_search` (GIN index for full-text search).
-   **Inventory**: `idx_inventory_low_stock` (Composite: merchant_id, quantity, reorder_level).
-   **Reports**: `idx_orders_reports` (Composite: merchant_id, created_at, payment_status, total_amount).

### Triggers & Constraints
-   **Invoice Numbering**: Atomic generation via `generateInvoiceNumber` service (uses explicit locking/transaction isolation rather than simple triggers to ensure gap-less sequences).
-   **Stock Deduction**: Enforced via application-level transaction logic in `OrderService` to prevent race conditions (checking `quantity_available` < `requested` inside `BEGIN...COMMIT`).

```mermaid
erDiagram
    USERS ||--o{ ORDERS : manages
    CUSTOMERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    PRODUCTS ||--|{ ORDER_ITEMS : listed_in
    PRODUCTS ||--|| INVENTORY : has_stock
```

---


## 8. Security Documentation

The system implements a **defense-in-depth** security strategy with multiple layers of protection. This section documents all security mechanisms in detail.

---

### 8.1 Authentication Architecture

The system supports **dual authentication modes** to accommodate different client types:

#### Session-Based Authentication (Primary)
- **Technology**: `express-session` with secure HTTP-only cookies
- **Cookie Name**: `connect.sid`
- **Session Duration**: 24 hours (configurable via `maxAge`)
- **Storage**: In-memory (can be upgraded to Redis for production scaling)
- **Security Settings**:
  - `httpOnly: true` - Prevents JavaScript access to cookies (XSS protection)
  - `sameSite: 'lax'` - CSRF protection while allowing navigation
  - `secure: false` - Set to `true` when HTTPS is enabled
  - `resave: true` - Forces session save on each request
  - `saveUninitialized: false` - Only saves sessions with data

**Session Secret Validation**:
```typescript
if (isProd && (!process.env.SESSION_SECRET || 
    process.env.SESSION_SECRET === 'your-session-secret-change-in-production')) {
  logger.error('SESSION_SECRET must be set to a secure value in production');
  process.exit(1);
}
```

#### Phantom Token Authentication (API Clients)
- **Purpose**: Prevents JWT theft from local storage by using an opaque reference token
- **Flow**:
  1. Client receives a **Phantom Token** (opaque string) after login
  2. Server maps Phantom Token → Short-lived JWT internally
  3. Client sends `Authorization: Bearer <phantom-token>`
  4. Server resolves phantom token to JWT and validates it
- **Benefits**:
  - JWT never exposed to client-side JavaScript
  - Tokens can be revoked server-side
  - Short-lived JWTs reduce exposure window
- **Implementation**: `backend/utils/jwt.ts` (`createPhantomTokenPair`, `resolvePhantomToken`)

#### Hybrid Authentication Middleware
The `authenticateUser` middleware (`backend/middleware/auth.ts`) supports both methods:
1. **Tries Phantom Token first** (if `Authorization` header present)
2. **Falls back to Session** (if session exists)
3. **Caches user data** (5-minute TTL) to reduce database queries
4. **Populates `req.user`** with user details for downstream handlers

---

### 8.2 Password Security

#### Hashing Algorithm
- **Algorithm**: **Argon2** (industry-standard, resistant to GPU/ASIC attacks)
- **Library**: `argon2` npm package
- **Functions**: `hashPassword()`, `verifyPassword()` in `user.model.ts`

#### Password Complexity Requirements
Enforced via `validatePassword` middleware (`backend/middleware/validation.ts`):
- Minimum **8 characters**
- At least **1 uppercase** letter
- At least **1 lowercase** letter
- At least **1 number**
- At least **1 special character** (`!@#$%^&*`)

**Validation Response**:
```json
{
  "message": "Password requirements not met",
  "errors": [
    "Password must contain uppercase letter",
    "Password must contain special character"
  ]
}
```

---

### 8.3 Rate Limiting Strategy

The system implements **5 distinct rate limiters** using `express-rate-limit`:

| Limiter | Scope | Window | Max Requests | Purpose |
|---------|-------|--------|--------------|---------|
| **apiLimiter** | `/api/*` | 15 min | 1000 | General API protection |
| **authLimiter** | `/api/auth/*` | 15 min | 100 | Prevent brute force login |
| **uploadLimiter** | `/api/*/upload*` | 1 min | 10 | Prevent upload abuse |
| **orderLimiter** | `/api/orders` (POST/PUT/PATCH/DELETE) | 1 min | 50 | Prevent order spam |
| **publicOrderLimiter** | `/api/public/orders/create` | 1 min | 200 (global) | Protect public order endpoint |

**Special Features**:
- **Public Order Limiter**: Global limit (not per-IP) to prevent system overload
- **Auth Limiter**: Returns `429` with `retryAfter` header
- **Selective Application**: Order limiter only applies to write operations (GET requests excluded)

**Implementation**: `backend/middleware/rate-limit.ts`

---

### 8.4 Account Lockout Protection

Prevents brute-force attacks by temporarily locking accounts after failed login attempts.

**Mechanism** (`backend/middleware/validation.ts`):
- **Tracking**: In-memory map of failed attempts per identifier (email/username/IP)
- **Threshold**: **5 failed attempts** → Account locked
- **Lockout Duration**: **15 minutes**
- **Auto-Cleanup**: Expired lockouts cleared every 5 minutes

**Functions**:
- `checkAccountLockout()` - Middleware to check if account is locked
- `trackFailedLogin(identifier)` - Increments failed attempt counter
- `clearFailedAttempts(identifier)` - Resets counter on successful login

**Response** (when locked):
```json
{
  "message": "Account locked. Try again in 12 minutes."
}
```

---

### 8.5 Input Validation & Sanitization

#### XSS Protection
`sanitizeInput` middleware (`backend/middleware/validation.ts`) recursively sanitizes:
- **Request Body** (`req.body`)
- **Query Parameters** (`req.query`)

**Sanitization Rules**:
- Strips HTML tags: `< > " ' &`
- Removes `javascript:` protocol
- Removes event handlers: `onclick=`, `onerror=`, etc.
- Trims whitespace

**Example**:
```javascript
Input:  "<script>alert('xss')</script>Hello"
Output: "Hello"
```

#### SQL Injection Protection
- **Primary Defense**: Parameterized queries (`pg` library with `$1, $2` placeholders)
- **Secondary Defense**: `sanitizeForSQL()` function strips dangerous characters (`'; " \`)

#### Path Traversal Protection
`preventUrlManipulation` middleware blocks suspicious URL patterns:
- `..` (directory traversal)
- `%2e`, `%2f`, `%5c` (encoded traversal)
- `etc/passwd`, `cmd.exe` (system file access)
- `%00` (null byte injection)

**Response** (when detected):
```json
{
  "message": "Access denied"
}
```

#### Log Injection Protection
`sanitizeForLog()` function prevents log poisoning by replacing newlines/tabs with underscores.

---

### 8.6 CORS (Cross-Origin Resource Sharing)

**Configuration** (`backend/index.ts`):
```typescript
const corsOptions = {
  origin: isProd ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['http://localhost:5173', 'http://localhost:3000', ...],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'Content-Type', 'Authorization', 'x-csrf-token'],
  exposedHeaders: ['set-cookie']
};
```

**Features**:
- **Credentials Support**: Allows cookies/sessions in cross-origin requests
- **Preflight Handling**: `OPTIONS` requests handled automatically
- **Environment-Specific**: Strict origins in production, permissive in development

---

### 8.7 HTTP Security Headers (Helmet.js)

`helmet` middleware sets secure HTTP headers:

**Content Security Policy (CSP)**:
```javascript
{
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  scriptSrc: ["'self'", "'unsafe-eval'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'", "ws:", "wss:"],
  objectSrc: ["'none'"]
}
```

**Other Headers**:
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - Enables browser XSS filter
- **HSTS Disabled** (currently using HTTP; enable when HTTPS is configured)

---

### 8.8 File Upload Security

**Restrictions** (`backend/index.ts` - Multer configuration):
- **Max File Size**: 8MB (configurable via `MAX_FILE_SIZE` env var)
- **Max Files**: 1 per request
- **Max Field Size**: 1MB
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/gif`, `text/csv`, Excel formats
- **Allowed Extensions**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.csv`, `.xls`, `.xlsx`

**Validation**:
```typescript
fileFilter: (_req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', ...];
  const fileExt = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type or extension'));
  }
}
```

**Storage**: In-memory (`multer.memoryStorage()`) to avoid disk-based attacks

---

### 8.9 Database Connection Pool Protection

**Pool Exhaustion Prevention** (`backend/middleware/pool-protection.ts`):
- **Monitors**: Active connections, idle connections, waiting requests
- **Threshold**: Rejects requests when pool utilization exceeds **95%**
- **Applied To**: Public order endpoints (high-traffic, unauthenticated)

**Response** (when pool exhausted):
```json
{
  "success": false,
  "message": "System is currently under heavy load. Please try again in a few moments.",
  "retryAfter": 30
}
```

**Pool Configuration** (`backend/db.ts`):
- **Max Connections**: 90 (configurable)
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 10 seconds

---

### 8.10 Role-Based Access Control (RBAC)

**Middleware** (`backend/middleware/auth.ts`):
- `requireRole(roles)` - Generic role checker
- `requireAdmin` - Admin-only access
- `requireAdminOrManager` - Admin or Manager access

**Usage Example**:
```typescript
router.patch('/inventory/:id/stock', requireAdmin, updateStockHandler);
```

**Roles**:
- `admin` - Full system access
- `manager` - Order/inventory management
- `employee` - Limited order operations
- `shipment` - Shipping operations
- `delivery` - Delivery operations

**Permission Matrix**: See Section 11 for detailed RBAC table.

---

### 8.11 CSRF Protection (Optional)

**Status**: Currently **disabled** (session-based auth with `sameSite` cookies provides sufficient protection)

**Implementation Available**:
- Middleware: `backend/middleware/csrf-protection.ts`
- Token Endpoint: `GET /api/csrf-token`
- Can be enabled by uncommenting in `backend/index.ts`

---

### 8.12 Request Size Validation

**Limits**:
- **JSON Body**: 10MB max
- **URL-Encoded Body**: 10MB max
- **Content-Length Header**: Validated before parsing

**Enforcement**:
```typescript
app.use((req, res, next) => {
  const size = parseInt(req.get('content-length') || '0');
  if (size > 10 * 1024 * 1024) {
    return res.status(413).json({ message: 'Request too large' });
  }
  next();
});
```

---

### 8.13 Security Event Logging

**Middleware**: `logSecurityEvents` (`backend/middleware/validation.ts`)

**Logs**:
- All **4xx/5xx responses** (failed auth, validation errors, etc.)
- Suspicious URL patterns
- Failed login attempts
- Account lockouts

**Log Format**:
```json
{
  "level": "warn",
  "message": "Security event",
  "ip": "192.168.1.1",
  "method": "POST",
  "url": "/api/auth/login",
  "status": 401,
  "userAgent": "Mozilla/5.0..."
}
```

---

### 8.14 WebSocket Security

**CORS Configuration** (Socket.IO):
```typescript
{
  origin: isProd ? process.env.ALLOWED_ORIGINS.split(',') : [...],
  credentials: true
}
```

**Transports**: WebSocket + Polling (fallback)
**Connection Logging**: All connections/disconnections logged with client ID and IP

---

### 8.15 Production Security Checklist

- [ ] Set `SESSION_SECRET` to a strong random value (validated on startup)
- [ ] Configure `ALLOWED_ORIGINS` with actual frontend domains
- [ ] Enable HTTPS and set `cookie.secure: true`
- [ ] Enable HSTS header (`hsts: true` in Helmet config)
- [ ] Upgrade session store to Redis (for multi-instance deployments)
- [ ] Review and tighten CSP directives
- [ ] Enable CSRF protection for state-changing operations
- [ ] Configure firewall rules to restrict database access
- [ ] Set up SSL/TLS for database connections
- [ ] Implement API key rotation for third-party services (AWS S3)

---

## 9. How Each Important Code Module Works

### Auth System (`auth.ts`, `jwt.ts`)
**Problem**: Securely authenticate users across web and potentially mobile clients.
**Solution**: Hybrid approach. Web uses secure cookies (Sessions). API clients use Phantom Tokens.
**Flow**: Login -> Generate Session + Phantom Token -> Store Phantom Token in Redis/DB (or stateless JWT mapping) -> Return to client.

### CSV Batch Processor (`csvService.ts`)
**Problem**: Uploading large CSV files (10k+ rows) times out standard requests.
**Solution**: Stream parsing + Batch processing.
**Flow**:
1.  Multer receives file stream.
2.  `csv-parser` reads row by row.
3.  Rows are accumulated into batches (e.g., 500).
4.  Each batch is processed in a DB transaction.
5.  Progress is emitted via WebSocket (`io.emit('csv-upload-progress')`).

### Order System (`orders.ts`, `orderService.ts`)
**Problem**: High-concurrency order creation requires data integrity.
**Solution**: ACID Transactions.
**Flow**: `BEGIN` -> Insert Order -> Insert Items -> Update Inventory (Check < 0) -> `COMMIT`. If any step fails, `ROLLBACK`.

### WebSocket Notification System
**Problem**: Real-time updates for dashboard without polling.
**Solution**: Socket.IO global instance.
**Usage**: `global.io.emit('event_name', data)` is called from Controllers/Services after successful mutations. Frontend hooks (`useWebSocket`) listen and update React Query cache.

### Error Handling & Logging System
**Problem**: Consistent error reporting and debugging in production.
**Solution**: Centralized error middleware + Winston-based Logger.
**Flow**:
1.  Routes use `try/catch` blocks.
2.  Errors are logged via `logger.error` with context (User ID, Request Path).
3.  `500 Internal Server Error` is returned to client with a generic message (security).
4.  In Development, full stack traces are returned.

### Product Catalog & Inventory Logic
**Problem**: Managing complex product data (images, variants) and stock levels.
**Solution**: Relational Schema + S3 for Media.
**Flow**:
1.  **Product**: Stored in `products` table (SKU, Name, Category).
2.  **Inventory**: Linked via `inventory` table. Separates "Product Data" from "Stock Data".
3.  **Images**: Uploaded to AWS S3. URLs stored in `product_images` table.
4.  **Public View**: `public-catalog` endpoints allow unauthenticated browsing but restrict stock visibility.

---

## 10. Environment Variables Documentation

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `PORT` | Server port number | No (Default: 5000) | `5000` |
| `NODE_ENV` | Environment mode | Yes | `production` / `development` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgres://user:pass@host:5432/db` |
| `SESSION_SECRET` | Session signing key | Yes | `randomstring` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | Yes | `https://app.com,https://admin.app.com` |
| `MAX_FILE_SIZE` | Max file upload size in bytes | No (Default: 8MB) | `8388608` |
| `AWS_REGION` | AWS Region for S3 | Yes | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | AWS Access Key | Yes | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key | Yes | `wJalr...` |
| `S3_BUCKET_NAME` | Bucket for product images | Yes | `ezpz-product-images` |
| `JWT_SECRET` | JWT signing key | Yes | `randomhex` |
| `JWT_ISSUER` | JWT Issuer claim | No | `ecommitra-api` |
| `JWT_AUDIENCE` | JWT Audience claim | No | `ecommitra-client` |

---

## 11. Permission Matrix (RBAC Table)

| Action | Admin | Manager | Employee | Shipment | Delivery |
|--------|-------|---------|----------|----------|----------|
| **User Management** | | | | | |
| Create User | ✔ | ✖ | ✖ | ✖ | ✖ |
| View All Users | ✔ | ✖ | ✖ | ✖ | ✖ |
| **Order Management** | | | | | |
| View Orders | ✔ | ✔ | ✔ | ✔ | ✔ (Assigned) |
| Create Order | ✔ | ✔ | ✔ | ✖ | ✖ |
| Update Order Status | ✔ | ✔ | ✖ | ✔ (Dispatch) | ✔ (Complete) |
| Update Payment Status | ✔ | ✔ | ✖ | ✖ | ✔ (COD) |
| Assign Order | ✔ | ✖ | ✖ | ✔ | ✖ |
| Process Returns | ✔ | ✔ | ✖ | ✔ | ✔ (Pickup) |
| **Inventory** | | | | | |
| View Inventory | ✔ | ✔ | ✔ | ✔ | ✖ |
| Update Stock | ✔ | ✖ | ✖ | ✖ | ✖ |
| Add Product | ✔ | ✖ | ✖ | ✖ | ✖ |
| **Financials** | | | | | |
| View Invoices | ✔ | ✔ | ✔ | ✔ | ✔ |
| View Reports | ✔ | ✔ | ✖ | ✖ | ✖ |

---

## 12. Frontend State Management Architecture

### React Query Integration
The application uses **TanStack Query (React Query)** for server state management.

-   **Query Keys**: Structured hierarchically (e.g., `['orders', { page, filter }]`, `['user']`).
-   **Caching**: Data is cached by default. Background refetching occurs on window focus.
-   **Invalidation**:
    -   Mutations (e.g., `createOrder`) trigger `queryClient.invalidateQueries(['orders'])`.
    -   WebSocket events trigger targeted updates or invalidations.
-   **WebSocket Sync**:
    -   `useWebSocketOrders` hook listens for `orderCreated` / `orderUpdated`.
    -   On event: Updates local cache directly (optimistic) OR triggers a refetch for consistency.

### Context Providers
| Provider | Purpose | Interaction |
|----------|---------|-------------|
| **AuthContext** | Manages User Session & Token. | Provides `user` object and `login`/`logout` methods to all components. Persists to `localStorage`. |
| **WebSocketContext** | Manages Socket.IO connection. | Maintains single socket connection. Exposes `socket` instance and `isConnected` state. |
| **ThemeContext** | Manages UI Theme (Dark/Light). | Persists preference to `localStorage`. Toggles Tailwind dark mode class. |

---

## 13. Component Library Documentation

| Component | Props | Description |
|-----------|-------|-------------|
| `<Layout />` | `children` | Main app shell with Sidebar and Navbar. |
| `<Sidebar />` | - | Collapsible navigation menu with role-based links. |
| `<FileUpload />` | `onUpload`, `accept`, `maxSize` | Drag-and-drop file uploader with progress bar. |
| `<OrdersList />` | `orders`, `loading`, `onStatusUpdate` | Complex data table with expandable rows and action buttons. |
| `<Pagination />` | `currentPage`, `totalOrders`, `onPageChange` | Reusable pagination control. |
| `<MetricsCards />` | `totalOrders`, `revenue`, `pending` | Dashboard summary cards with trend indicators. |
| `<Modal />` | `isOpen`, `onClose`, `title` | Generic modal wrapper (used by specific modals like `AssignmentModal`). |
| `<ProtectedRoute />` | `children`, `allowedRoles` | Route guard that redirects unauthorized users. |

---

## 14. Error Handling Strategy

### Backend Error Response Structure
All API errors follow a consistent JSON format:

```json
{
  "message": "Human readable error message",
  "error": "Detailed error info (Development only)",
  "code": "OPTIONAL_ERROR_CODE",
  "errors": ["Array of validation errors if applicable"]
}
```

### Error Categories & Examples

#### 1. Validation Errors (400)
Returned when input fails sanitization or schema checks.
```json
{
  "message": "Validation Failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

#### 2. Authentication Errors (401)
Returned when session/token is invalid or missing.
```json
{
  "message": "Authentication required. Please log in.",
  "code": "AUTH_REQUIRED"
}
```

#### 3. Authorization Errors (403)
Returned when a user tries to access a resource they don't have permission for.
```json
{
  "message": "You do not have permission to perform this action",
  "code": "INSUFFICIENT_PERMISSIONS",
  "requiredRole": "admin"
}
```

#### 4. Conflict Errors (409)
Returned when trying to create a duplicate resource.
```json
{
  "message": "User with this email already exists",
  "code": "DUPLICATE_RESOURCE"
}
```

#### 5. Server Errors (500)
Logged with stack trace on server. Client receives generic message.
```json
{
  "message": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

### Client-Side Handling
-   **API Layer**: `fetch` wrappers catch non-2xx responses and throw Errors with the message from the body.
-   **UI Layer**: React Query `isError` state is used to show error toasts or fallback UI.
-   **Modals**: Specific modals (like `ProcessingErrorsModal`) display batch processing errors.

---

## 15. Logging Format & Structure

The application uses a custom Winston-like logger (`backend/utils/logger.ts`) with sanitization to prevent log injection.

### Log Levels
-   **INFO**: Normal application flow (e.g., "User logged in", "Order created").
-   **WARN**: Expected issues (e.g., "Login failed", "Stock low").
-   **ERROR**: Unexpected exceptions (e.g., "DB Connection failed", "S3 Upload error").

### Log Structure
```text
[ISO_TIMESTAMP] LEVEL: Message | Data: { "key": "value" }
```

### Example
```text
[2024-11-22T10:00:00.000Z] INFO: User logged in successfully | Data: { "userId": 123 }
[2024-11-22T10:05:00.000Z] WARN: Suspicious URL detected | Data: { "url": "/api/..%2fetc/passwd", "ip": "192.168.1.1" }
```

### Tracing
-   **Request Logging**: Every request is logged: `[TIME] INFO: GET /api/orders`.
-   **Context**: Logs often include `userId` or `orderId` in the Data field to trace actions to specific entities.

---

## 16. Data Validation Strategy

### Validation Layers
1.  **Input Sanitization (Global Middleware)**:
    -   `sanitizeInput`: Recursively strips HTML tags, `javascript:` protocols, and SQL injection patterns from `req.body` and `req.query`.
    -   `preventUrlManipulation`: Blocks directory traversal attempts in URLs.
2.  **Schema Validation (Route Level)**:
    -   Manual checks in controllers (e.g., `if (!email || !password) ...`).
    -   Specific validators: `validatePassword` (complexity), `validatePhoneNumber` (Indian format), `validatePagination`.
3.  **Database Constraints**:
    -   Foreign Key constraints ensure relational integrity.
    -   Unique constraints on `email` and `username`.

### Example Validation Rule (Password)
-   Min 8 characters.
-   At least 1 Uppercase.
-   At least 1 Lowercase.
-   At least 1 Number.
-   At least 1 Special Character.

### Sanitization Example
Input: `<script>alert('xss')</script>Hello`
Output: `Hello`

---
---

## 18. API Error Codes Reference

The API uses standard HTTP Status Codes to indicate success or failure. Specific error codes are returned in the JSON body for programmatic handling.

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| **200** | OK | Successful GET, PATCH, or Login. |
| **201** | Created | Successful POST (Order/User creation). |
| **400** | Bad Request | Validation failed (Missing fields, Invalid password). |
| **401** | Unauthorized | Missing or invalid Session/Token. |
| **403** | Forbidden | Authenticated but lacks permission (Role mismatch). |
| **404** | Not Found | Resource (Order, User, Product) does not exist. |
| **409** | Conflict | Duplicate resource (Email/Phone already exists). |
| **413** | Payload Too Large | File upload exceeds limit (Default 8MB). |
| **429** | Too Many Requests | Rate limit exceeded. |
| **500** | Internal Server Error | Unhandled exception or DB connection failure. |

---

## 19. Sequence Diagrams

### Order Creation Flow
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant Socket
    
    Client->>API: POST /api/orders (Items, Customer)
    API->>API: Validate Input & Stock
    API->>DB: BEGIN Transaction
    API->>DB: Insert Order & Items
    API->>DB: Update Inventory (Stock - Qty)
    alt Stock < 0
        DB-->>API: Error (Constraint Violation)
        API->>DB: ROLLBACK
        API-->>Client: 400 Bad Request
    else Stock OK
        API->>DB: COMMIT
        API->>Socket: Emit 'orderCreated'
        API-->>Client: 201 Created
    end
```

### Payment & Invoice Flow
```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant DB
    participant InvoiceService
    
    Admin->>API: PATCH /api/orders/:id/payment (Status='paid')
    API->>DB: Update Order Payment Status
    API->>InvoiceService: createInvoiceFromOrder(orderId)
    InvoiceService->>DB: Fetch Order & Billing Details
    InvoiceService->>InvoiceService: Calculate GST (CGST+SGST or IGST)
    InvoiceService->>DB: Insert Invoice & Items
    API->>Socket: Emit 'invoice-auto-created'
    API-->>Admin: 200 OK
```

### Inventory Update Flow
```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant DB
    
    Admin->>API: PATCH /api/inventory/:id/stock
    API->>API: requireAdmin()
    API->>DB: UPDATE inventory SET quantity = $1
    API->>DB: Log Action (Audit Trail)
    API-->>Admin: 200 OK
```

---

## 20. Additional Module Details

### Reports Module (`backend/reports/`)
**Purpose**: Aggregates data for the Admin Dashboard and Analytics.
**Key Logic**:
-   **Parallel Execution**: Uses `Promise.all` to execute multiple heavy queries (Today's Orders, Revenue, Low Stock, Top Products) simultaneously for performance.
-   **On-the-fly Calculation**: Calculates KPIs like **Gross Profit** (`Revenue - Adjusted COGS`) and **Profit Margin** in memory after fetching raw totals.
-   **Files**: `dashboardService.ts` (Aggregation), `kpiService.ts` (Specific metrics).

### Returns Module (`backend/returns/`)
**Purpose**: Manages product return requests with automatic inventory restocking.
**Key Logic**:
-   **Status Management**: Handles three status types: `approval_status` (approved/rejected), `receipt_status` (received/inspected), and general `status`.
-   **Automatic Inventory Restocking**: When receipt status is updated to 'received' or 'inspected', inventory is automatically restocked via `emitInventoryRestockNotification`.
-   **Transaction Safety**: Status updates are committed first, then inventory restocking happens in a separate connection to prevent rollback of status changes if restocking fails.
-   **Bulk Operations**: Supports bulk status updates for multiple returns via `/bulk-status` endpoint.
-   **Files**: `return-queries.ts` (Queries), `status-update-service.ts` (Status logic), `inventory-notification-service.ts` (Restocking).

### Employee Module (`backend/employee/`)
**Purpose**: Provides employee-specific order management endpoints.
**Key Logic**:
-   **Role-Based Operations**: Employees can view assigned orders and update order statuses based on their role permissions.
-   **Assigned Orders**: Fetches orders that have been assigned to the logged-in employee (typically with 'shipped' status).
-   **Status Updates**: Employees can update order statuses according to their role (e.g., Delivery employees can mark orders as 'completed').
-   **Files**: `employee-queries.ts` (in orders/queries), `statusService.ts` (Status update logic).

### Public Catalog Module (`backend/public-catalog/`)
**Purpose**: Provides unauthenticated access to merchant product catalogs for public browsing.
**Key Logic**:
-   **No Authentication Required**: All endpoints are publicly accessible for customers to browse products.
-   **Merchant-Scoped**: All queries are scoped to a specific merchant ID to show only that merchant's products.
-   **Filtering & Pagination**: Supports category filtering, search, featured products, and pagination.
-   **Services**: `merchantService.ts` (Merchant info), `productService.ts` (Product listings), `categoryService.ts` (Categories).

### Public Orders Module (`backend/public-orders/`)
**Purpose**: Allows customers to place orders directly from the public catalog without authentication.
**Key Logic**:
-   **Rate Limiting**: Protected by `publicOrderLimiter` to prevent abuse (prevents 100 simultaneous orders).
-   **Pool Protection**: Uses `poolProtectionMiddleware` to reject requests when database pool utilization exceeds 95%.
-   **Customer Creation**: Automatically creates or finds customer records based on phone number.
-   **Order Creation**: Creates complete orders with customer, address, and order items in a single transaction.
-   **Inventory Validation**: Validates stock availability before order creation.
-   **Files**: `order-creation-service.ts` (Order creation logic).

### Invoices Module (`backend/invoices/`)

**Purpose**: Generates compliant tax invoices.
**Key Logic**:
-   **Atomic Numbering**: Generates sequential invoice numbers (e.g., `INV-001`) using a database function/query to prevent duplicates.
-   **GST Logic**:
    -   Compares `Merchant State Code` vs `Customer State Code`.
    -   **Same State**: Applies **CGST + SGST** (Split 50/50).
    -   **Different State**: Applies **IGST** (Full Rate).
-   **Data Snapshot**: Copies product prices and names into `invoice_items` to preserve history even if product details change later.

---

## 21. Glossary / Domain Definitions

| Term | Definition |
|------|------------|
| **Merchant** | The business entity using the platform to sell goods. |
| **Phantom Token** | An opaque reference string stored on the client, mapped to a short-lived JWT on the server for security. |
| **Order** | A transaction record representing a customer's purchase of one or more items. |
| **Inventory Item** | A specific product record tracking stock quantity (`quantity_available`) and location. |
| **Invoice** | A legal document generated after payment, containing tax details (CGST/SGST/IGST). |
| **SKU** | Stock Keeping Unit - a unique identifier for each product variant. |
| **RBAC** | Role-Based Access Control (Admin, Manager, Employee permissions). |
| **CSV Batch** | A chunk of rows (e.g., 500) processed together during bulk upload to manage memory and DB load. |
| **Optimistic UI** | Updating the frontend state immediately before the server confirms the action (used in React Query). |
| **Soft Delete** | Marking a record as deleted (e.g., `deleted_at` timestamp) without removing it from the database. |

---

## 22. Module Dependency Diagram

This diagram illustrates how different backend modules interact and depend on each other.

```mermaid
graph TD
    Auth[Auth Module] --> Users[User Module]
    
    Orders[Order Module] --> Inventory[Inventory Module]
    Orders --> Invoices[Invoice Module]
    Orders --> Reports[Reports Module]
    
    Inventory --> Reports
    
    Invoices --> Reports
    
    subgraph Core
        Auth
        Users
    end
    
    subgraph Operations
        Orders
        Inventory
        Invoices
    end
    
    subgraph Analytics
        Reports
    end
```

---

## 23. CSV Upload Sequence

Detailed flow for the Bulk Order Upload feature (`/api/orders/upload-csv`).

```mermaid
sequenceDiagram
    participant Client
    participant Multer
    participant CSVService
    participant DB
    participant Socket
    
    Client->>Multer: POST /upload-csv (File Stream)
    Multer->>CSVService: Pass File Path
    loop For Each Batch (500 rows)
        CSVService->>CSVService: Parse & Validate Rows
        CSVService->>DB: BEGIN Transaction
        CSVService->>DB: Insert Orders & Items
        CSVService->>DB: Update Inventory
        alt Error in Batch
            DB-->>CSVService: Error
            CSVService->>DB: ROLLBACK
            CSVService->>Socket: Emit 'error-batch'
        else Success
            CSVService->>DB: COMMIT
            CSVService->>Socket: Emit 'progress' (Processed Count)
        end
    end
    CSVService-->>Client: 200 OK (Upload Started)
```

---

## 24. State Machine Diagrams

### Order Status Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Processing: Payment Confirmed / Manual Approval
    Processing --> Completed: Order Fulfilled
    Processing --> Cancelled: User/Admin Cancel
    Pending --> Cancelled: Timeout / User Cancel
    Completed --> [*]
    Cancelled --> [*]
```

### Payment Status Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Unpaid
    Unpaid --> Paid: Payment Gateway / Manual Entry
    Unpaid --> Failed: Transaction Failed
    Paid --> Refunded: Full Refund Processed
    Failed --> Unpaid: Retry Payment
    Refunded --> [*]
```

---

## 25. Frontend Component Map

Overview of how key pages are composed of reusable components.

### **Dashboard (`src/pages/Dashboard.tsx`)**
-   `Layout`: Main wrapper.
-   `MetricsCards`: Top-level KPI summary.
-   `RecentOrdersTable`: Simplified view of latest orders.
-   `SalesChart`: Visual revenue trend.

### **Orders Page (`src/pages/Orders.tsx`)**
-   `OrdersList`: Main data table with expandable rows.
-   `SearchToolbar`: Filters for status, date, and search text.
-   `Pagination`: Page navigation control.
-   `AssignmentModal`: Popup for assigning orders to employees.
-   `AddOrderModal`: Form for manual order creation.

### **Product Catalog (`src/pages/ProductCatalog.tsx`)**
-   `ProductGrid`: Grid view of product cards.
-   `ProductCard`: Individual item display with image and stock.
-   `FileUpload`: Drag-and-drop zone for bulk CSV or image upload.
-   `EditProductModal`: Form for updating product details.

---

## 26. Frontend Build & Performance

### Build Architecture (Vite)
The frontend uses **Vite** for lightning-fast HMR and optimized production builds.

**Key Optimizations (`vite.config.ts`):**
1.  **Manual Chunking**: Dependencies are split into separate chunks to maximize browser caching.
    -   `react-vendor`: React, React DOM.
    -   `framer-motion`: Animation library.
    -   `lucide`: Icon pack.
2.  **Minification**: Uses `terser` to drop console logs and debugger statements in production.
3.  **CSS Code Splitting**: Enabled to load only the CSS needed for the current chunk.

### Performance Best Practices
-   **Lazy Loading**: Route-based code splitting via `React.lazy` (implied by Wouter/Vite structure).
-   **Asset Optimization**: Images < 4KB are inlined as Base64 strings.
-   **GPU Acceleration**: CSS classes like `.gpu-accelerated` use `transform: translateZ(0)` to force layer promotion.
-   **Virtualization**: Large lists should use `react-window` (dependency present in `package.json`).

### Environment Variables
-   **Development**: `.env` file.
-   **Production**: Injected at build time or runtime.
-   **Access**: via `import.meta.env.VITE_API_URL`.

---

## 27. Design System & UX Guidelines

### Color Palette
The system uses a semantic color scale defined in `tailwind.config.js`.

| Token | Hex | Usage |
|-------|-----|-------|
| **Primary** | `#6C63FF` (Purple) | Main actions, buttons, active states. |
| **Accent** | `#00E1FF` (Cyan) | Highlights, gradients, secondary actions. |
| **Warm** | `#FFB703` (Amber) | Warnings, attention-grabbing elements. |
| **Surface** | `#0B1220` (Deep Blue) | Main background (Dark Mode default). |
| **Text** | `#F3F4F6` (Gray-100) | Primary readability. |

### Typography
-   **Font Family**: `Noto Sans` (Body/UI), `Orbitron` (Headings/Techno feel).
-   **Scale**: Tailwind default scale (`text-sm`, `text-base`, `text-lg`, `text-xl`).

### UX Patterns
1.  **Glassmorphism**: Used for cards and modals (`bg-surface-800/60 backdrop-blur-xl`).
2.  **Gradients**: Used for headings (`heading-gradient`) and CTAs (`cta-gradient`) to create depth.
3.  **Feedback**:
    -   **Loading**: Skeleton screens or spinners for async actions.
    -   **Success/Error**: Toast notifications (via `sonner` or custom toast).
4.  **Accessibility**:
    -   Focus rings are preserved.
    -   Semantic HTML (`<button>`, `<nav>`, `<main>`) is prioritized.
    -   Contrast ratios are maintained via the high-contrast dark theme.

### Responsive Breakpoints
| Prefix | Width | Device |
|--------|-------|--------|
| `sm` | 640px | Mobile Landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |

---

## 28. Testing Setup & Strategy

### Testing Framework
- **Framework**: **Vitest** (Vite-native test runner)
- **UI Testing**: `@testing-library/react` + `@testing-library/dom`
- **API Testing**: `supertest`
- **Coverage**: `vitest run --coverage`

### Test Structure
```
test/
├── backend/
│   ├── auth.test.ts       # Authentication tests
│   └── health.test.ts     # Health check endpoint tests
└── frontend/
    └── App.test.tsx       # Frontend component tests
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Configuration
**File**: `vitest.config.ts`
- **Environment**: `jsdom` (for frontend tests)
- **Setup Files**: Configured for React Testing Library
- **Coverage**: Enabled with detailed reporting

### Backend Test Example
```typescript
// test/backend/auth.test.ts
describe('Authentication', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ emailOrPhone: 'test@example.com', password: 'Test123!' });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### Test Mode Protection
**Critical**: Server auto-start is disabled in test mode to prevent port conflicts:
```typescript
// backend/index.ts
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(error => {
    logger.error('Failed to start server', error);
    process.exit(1);
  });
}
```

---

## 29. Deployment & Build Process

### Build Commands
```bash
# Development (Frontend + Backend concurrently)
npm run dev

# Production Build
npm run build                    # Builds both frontend and backend
npm run build:frontend           # Frontend only (TypeScript + Vite)
npm run build:backend            # Backend only (TypeScript)

# Start Production Server
npm start                        # Uses PM2 via start-production.mjs
```

### Build Output
- **Frontend**: `dist/` (static files served by Express in production)
- **Backend**: `backend/` (compiled TypeScript → JavaScript)

### Production Startup Script
**File**: `start-production.mjs`
- **Process Manager**: PM2 (ecosystem.config.cjs)
- **Instances**: 1 (can be scaled)
- **Auto-Restart**: Enabled
- **Log Files**: `logs/error.log`, `logs/out.log`

### PM2 Configuration
**File**: `ecosystem.config.cjs`
```javascript
{
  name: 'ecommittra-server',
  script: 'backend/index.js',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'production',
    PORT: 5000
  }
}
```

### Environment Files
**Location**: `envfiles/`
- `dev.env` - Development environment
- `prod.env` - Production environment

**Loading Logic** (`backend/index.ts`):
```typescript
const envFile = process.env.NODE_ENV === 'production' ? 'prod.env' : 'dev.env';
const envPath = path.join(process.cwd(), 'envfiles', envFile);
dotenv.config({ path: envPath });
```

### Deployment Checklist
- [ ] Set all required environment variables in `envfiles/prod.env`
- [ ] Run `npm run build` to compile frontend and backend
- [ ] Verify `SESSION_SECRET` is set to a strong value
- [ ] Configure `ALLOWED_ORIGINS` with actual frontend domain
- [ ] Set up PostgreSQL database and run migrations
- [ ] Configure AWS S3 credentials for file uploads
- [ ] Set up SSL/TLS certificate (for HTTPS)
- [ ] Configure firewall rules (allow port 5000, restrict DB access)
- [ ] Start server with `npm start` (uses PM2)
- [ ] Monitor logs in `logs/` directory

### Static File Serving (Production)
```typescript
if (isProd) {
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
}
```

---

## 30. WebSocket Events Documentation

### Connection Setup
**Server**: `backend/index.ts` (Socket.IO server)
**Client**: Frontend uses `socket.io-client`

### Server Configuration
```typescript
const io = new SocketIOServer(server, {
  cors: {
    origin: isProd ? process.env.ALLOWED_ORIGINS.split(',') : [...],
    credentials: true
  },
  transports: ['websocket', 'polling']
});
```

### Connection Events

#### Server → Client Events
| Event | Payload | Description |
|-------|---------|-------------|
| `welcome` | `{ message, timestamp, serverPort }` | Sent on initial connection |
| `connection-test-response` | `{ success, serverTimestamp, clientId, socketId }` | Response to connection test |
| `orderCreated` | `{ order }` | New order created |
| `orderUpdated` | `{ orderId, status }` | Order status changed |
| `order-status-updated` | `{ orderId, status }` | Order status updated |
| `invoice-auto-created` | `{ invoiceId, orderId }` | Invoice auto-generated after payment |
| `csv-upload-progress` | `{ processed, total, percentage }` | CSV upload progress |
| `error-batch` | `{ batchNumber, errors }` | CSV batch processing errors |
| `inventory-restocked` | `{ returnId, items }` | Inventory restocked from return |

#### Client → Server Events
| Event | Payload | Description |
|-------|---------|-------------|
| `connection-test` | `{ clientId, timestamp }` | Test connection |
| `disconnect` | - | Client disconnected |

### Usage Example (Backend)
```typescript
// Emit event to all connected clients
global.io.emit('orderCreated', { order: newOrder });

// Emit to specific room/user
io.to(userId).emit('notification', { message: 'Order shipped' });
```

### Usage Example (Frontend)
```typescript
// In WebSocketContext
socket.on('orderCreated', (data) => {
  queryClient.invalidateQueries(['orders']);
  toast.success(`New order #${data.order.order_id} created`);
});
```

### Connection Logging
All connections/disconnections are logged:
```typescript
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', {
    id: socket.id,
    transport: socket.conn.transport.name,
    userAgent: socket.conn.request.headers['user-agent']
  });
});
```

### Status Endpoint
**Endpoint**: `GET /api/websocket-status`
**Response**:
```json
{
  "status": "WebSocket server is running",
  "connectedClients": 5,
  "port": 5000,
  "timestamp": "2024-11-22T10:00:00.000Z"
}
```

---

## 31. Billing Details Module

### Purpose
Manages merchant billing information for invoice generation (GST, PAN, bank details, billing address).

### API Endpoints

#### Get Billing Details
**Endpoint**: `GET /api/billing-details`
**Auth**: Required
**Response**:
```json
{
  "billingDetails": {
    "billing_id": 1,
    "merchant_id": 123,
    "gst_number": "29ABCDE1234F1Z5",
    "pan_number": "ABCDE1234F",
    "billing_address_line1": "123 Main St",
    "billing_city": "Bangalore",
    "billing_state": "Karnataka",
    "billing_pincode": "560001",
    "state_code": "29",
    "bank_name": "HDFC Bank",
    "bank_account_number": "1234567890",
    "ifsc_code": "HDFC0001234",
    "invoice_prefix": "INV-",
    "next_invoice_number": 1000000001
  }
}
```

#### Create/Update Billing Details
**Endpoint**: `POST /api/billing-details`
**Auth**: Required
**Request Body**:
```json
{
  "gst_number": "29ABCDE1234F1Z5",
  "pan_number": "ABCDE1234F",
  "billing_address_line1": "123 Main St",
  "billing_city": "Bangalore",
  "billing_state": "Karnataka",
  "billing_pincode": "560001",
  "state_code": "29",
  "bank_name": "HDFC Bank",
  "bank_account_number": "1234567890",
  "ifsc_code": "HDFC0001234",
  "invoice_prefix": "INV-"
}
```

### Validation Rules

#### GST Number
- **Format**: 15 characters (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`)
- **Example**: `29ABCDE1234F1Z5`
- **Error**: `"Invalid GST number format. Please enter a valid 15-character GST number."`

#### PAN Number
- **Format**: 10 characters (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`)
- **Example**: `ABCDE1234F`
- **Error**: `"Invalid PAN number format. Please enter a valid 10-character PAN number."`

#### IFSC Code
- **Format**: 11 characters (`^[A-Z]{4}0[A-Z0-9]{6}$`)
- **Example**: `HDFC0001234`
- **Error**: `"Invalid IFSC code format. Please enter a valid 11-character IFSC code."`

### Required Fields
- `billing_address_line1`
- `billing_city`
- `billing_state`
- `billing_pincode`

### Database Table
**Table**: `oms.merchant_billing_details`
**Key Fields**:
- `billing_id` (PK)
- `merchant_id` (FK → merchants)
- `gst_number`, `pan_number`
- Billing address fields
- Bank details
- `invoice_prefix`, `next_invoice_number` (for invoice numbering)
- `state_code` (for GST calculation)

### Usage in Invoice Generation
The billing details are used by the Invoice Module to:
1. Generate compliant tax invoices with GST/PAN
2. Determine CGST+SGST vs IGST based on `state_code`
3. Include bank details for payment instructions
4. Generate sequential invoice numbers using `invoice_prefix` + `next_invoice_number`

---

## 17. Backup & Recovery Procedures

### Database Backup Strategy

#### Automated Backups
**Recommended Setup** (not included in codebase, requires external configuration):
```bash
# Daily backup cron job (example)
0 2 * * * pg_dump -U postgres -d ecommittra > /backups/ecommittra_$(date +\%Y\%m\%d).sql
```

#### Manual Backup
```bash
# Full database backup
pg_dump -U postgres -d ecommittra -F c -f backup.dump

# Schema-only backup
pg_dump -U postgres -d ecommittra --schema-only > schema.sql

# Data-only backup
pg_dump -U postgres -d ecommittra --data-only > data.sql
```

#### Restore from Backup
```bash
# Restore from custom format
pg_restore -U postgres -d ecommittra backup.dump

# Restore from SQL file
psql -U postgres -d ecommittra < backup.sql
```

### Application State Backup

#### Session Data
- **Current**: In-memory (lost on restart)
- **Recommendation**: Upgrade to Redis with persistence enabled

#### File Uploads
- **Storage**: AWS S3 (automatically backed up by AWS)
- **Versioning**: Enable S3 versioning for critical buckets

#### Logs
- **Location**: `logs/` directory
- **Retention**: Configure log rotation (e.g., keep 30 days)
- **Backup**: Periodically archive to S3 or external storage

### Disaster Recovery Plan

#### Database Failure
1. Stop application server
2. Restore database from latest backup
3. Verify data integrity
4. Restart application server
5. Monitor logs for errors

#### Application Server Failure
1. Deploy backup server instance
2. Update DNS/load balancer to point to backup
3. Restore environment variables
4. Start application with `npm start`

#### Data Corruption
1. Identify affected tables/records
2. Restore from point-in-time backup (if available)
3. Manually reconcile recent transactions
4. Verify data consistency

### Backup Verification
**Recommended**: Monthly backup restoration tests
1. Restore backup to test environment
2. Verify all tables and data integrity
3. Test critical application flows
4. Document any issues

---

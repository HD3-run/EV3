# Comprehensive Process Flow Documentation

## 1. File Structure Analysis

### Main Directories
- **backend/**: Server-side code, API endpoints, database interactions
- **src/**: Frontend React application
- **public/**: Static assets
- **dist/**: Build output
- **node_modules/**: Dependencies

### Key Files and Their Purpose

#### Backend
- **backend/index.ts**: Entry point for the backend server
- **backend/server.js**: Server configuration and startup
- **backend/routes.ts**: API route definitions
- **backend/db.ts**: Database connection and query utilities
- **backend/user.model.ts**: User data model and authentication logic
- **backend/orders.ts**: Order processing logic
- **backend/inventory.ts**: Inventory management
- **backend/invoices.ts**: Invoice generation and management
- **backend/returns.ts**: Product return processing
- **backend/reports.ts**: Reporting functionality
- **backend/billing-details.ts**: Customer billing information

#### Frontend
- **src/main.tsx**: Entry point for the React application
- **src/App.tsx**: Main application component
- **src/context/AuthContext.tsx**: Authentication state management
- **src/context/WebSocketContext.tsx**: Real-time communication
- **src/pages/**: Page components for different routes
- **src/components/**: Reusable UI components
- **src/hooks/useAuthFetch.ts**: Custom hook for authenticated API requests

#### Configuration
- **package.json**: Project dependencies and scripts
- **tsconfig.json**: TypeScript configuration
- **vite.config.ts**: Vite bundler configuration
- **tailwind.config.js**: Tailwind CSS configuration

### Dependencies Between Files

- **Frontend-Backend**: The frontend communicates with the backend through API calls defined in `src/config/api.ts`
- **Authentication**: `AuthContext.tsx` manages auth state, using `useAuthFetch.ts` for API calls to `backend/middleware/auth.ts`
- **Data Flow**: UI components in `src/pages/` make API calls to corresponding backend routes in `backend/routes.ts`

## 2. Code Functionality Breakdown

### Real-Time Communication System
- **WebSocket Implementation**: Robust Socket.IO implementation in `src/context/WebSocketContext.tsx` and `backend/index.ts`
- **Connection Management**: Automatic reconnection with exponential backoff and connection testing
- **Event Types**:
  - CSV upload progress tracking
  - Inventory updates (stock changes, new products)
  - Order status changes
  - Invoice status updates
  - Return processing notifications
- **Error Handling**: Comprehensive error handling for connection failures and event processing

### Authentication System
- **User Registration**: Handled by `backend/user.model.ts` with Argon2 password hashing in `backend/utils/password.ts`
- **Login Process**: Phantom token pattern with opaque tokens in `backend/utils/jwt.ts` and validation in `backend/middleware/auth.ts` and `backend/middleware/phantom-auth.ts`
- **Session Management**: Dual authentication system with both phantom tokens and session-based authentication for enhanced security
- **Password Security**: Argon2id algorithm for new passwords with fallback support for legacy bcrypt and PBKDF2 hashes

### Inventory Management
- **Product Tracking**: CRUD operations in `backend/inventory.ts`
- **SKU Generation**: Utility in `backend/utils/sku.ts`
- **Stock Updates**: Real-time updates via WebSocket in `src/context/WebSocketContext.tsx`

### Order Processing
- **Order Creation**: Handled in `backend/orders.ts`
- **Validation**: Input validation in `backend/middleware/validation.ts`
- **Status Updates**: Status tracking and validation in `backend/utils/status-validation.ts`

### Reporting System
- **Data Aggregation**: Query building in `backend/utils/query-builder.ts`
- **Report Generation**: Report logic in `backend/reports.ts`
- **Data Visualization**: Frontend components in `src/pages/Reports.tsx`

## 3. System Workflow Documentation

### User Authentication Flow
1. **Signup**:
   - User enters details in `src/pages/Signup.tsx`
   - Form data sent to `/api/auth/register` endpoint
   - `backend/user.model.ts` validates input and creates user
   - Password hashed using `backend/utils/password.ts`
   - User record stored in database

2. **Login**:
   - User enters credentials in `src/pages/Login.tsx`
   - Form data sent to `/api/auth/login` endpoint
   - `backend/middleware/auth.ts` validates credentials
   - JWT token generated using `backend/utils/jwt.ts`
   - Token returned to client and stored in `AuthContext.tsx`
   - Protected routes use `ProtectedRoute.tsx` component for access control

### Product Management Process
1. **Adding Products**:
   - Admin uses `src/pages/Inventory.tsx` interface
   - Product data sent to `/api/inventory` endpoint
   - `backend/inventory.ts` validates and stores product data
   - SKU generated using `backend/utils/sku.ts`

2. **Updating Inventory**:
   - Stock levels updated through `src/pages/EmployeeInventory.tsx`
   - Updates sent to `/api/inventory/:id` endpoint
   - `backend/inventory.ts` processes updates
   - Real-time updates broadcast via WebSocket

### Order Processing Pipeline
1. **Order Creation**:
   - Customer creates order in `src/pages/Orders.tsx`
   - Order data sent to `/api/orders` endpoint
   - `backend/orders.ts` validates order data
   - Inventory checked for availability
   - Order status set to "pending"

2. **Order Fulfillment**:
   - Employee processes order in `src/pages/EmployeeOrders.tsx`
   - Status updates sent to `/api/orders/:id` endpoint
   - `backend/orders.ts` updates order status
   - Inventory adjusted using `backend/inventory.ts`
   - Invoice generated using `backend/invoices.ts`

3. **Returns Processing**:
   - Return requests initiated in UI
   - Processed through `backend/returns.ts`
   - Inventory updated accordingly
   - Refund processed if applicable

## 4. Technical Component Mapping

### API Endpoints

#### Authentication
- `POST /api/auth/register`: User registration
- `POST /api/auth/login`: User login
- `POST /api/auth/logout`: User logout
- `GET /api/auth/verify`: Token verification

#### Inventory
- `GET /api/inventory`: List all products
- `POST /api/inventory`: Add new product
- `GET /api/inventory/:id`: Get product details
- `PUT /api/inventory/:id`: Update product
- `DELETE /api/inventory/:id`: Remove product

#### Orders
- `GET /api/orders`: List all orders
- `POST /api/orders`: Create new order
- `GET /api/orders/:id`: Get order details
- `PUT /api/orders/:id`: Update order status
- `DELETE /api/orders/:id`: Cancel order

#### Invoices
- `GET /api/invoices`: List all invoices
- `GET /api/invoices/:id`: Get invoice details
- `POST /api/invoices/generate`: Generate new invoice

#### Reports
- `GET /api/reports/sales`: Sales reports
- `GET /api/reports/inventory`: Inventory reports
- `GET /api/reports/custom`: Custom report generation

### Database Queries

#### User Management
- `getUserByEmail`: Retrieves user by email for authentication
- `createUser`: Creates new user record
- `updateUserDetails`: Updates user information

#### Inventory Management
- `getProducts`: Retrieves all products with optional filtering
- `getProductById`: Retrieves specific product details
- `updateProductStock`: Updates product inventory levels
- `createProduct`: Adds new product to inventory

#### Order Processing
- `createOrder`: Creates new order record
- `getOrdersByUser`: Retrieves orders for specific user
- `updateOrderStatus`: Updates order status
- `getOrderDetails`: Retrieves complete order information

### External Service Integrations
- **Payment Processing**: Integration with payment gateway in `backend/billing-details.ts`
- **Email Notifications**: Order confirmations and updates
- **Reporting Tools**: Data export functionality in `backend/reports.ts`

## 5. Application Architecture

### Data Flow
- **Client-Server Communication**: REST API with JSON payloads
- **Database Interactions**: Parameterized SQL queries via node-postgres
- **State Management**: React Context API for global state
- **Caching System**: In-memory caching implementation in `backend/middleware/cache.ts`
  - User-specific cache keys with automatic invalidation
  - Configurable TTL (Time-To-Live) for cached responses
  - Cache invalidation on data mutations (orders, inventory, etc.)
  - HTTP cache headers for browser-side caching control
- **Batch Processing**: Optimized bulk operations in `backend/utils/batch-processor.ts`
  - Configurable batch sizes for CSV imports
  - Progress tracking via WebSockets
  - Automatic retry mechanisms with exponential backoff
  - Transaction management for data consistency

### Data Flow Between Components

1. **User Authentication**:
   ```
   Client → Login Form → AuthContext → API Request → 
   Backend Auth Middleware → JWT Verification → 
   Database Query → Response → AuthContext Update → 
   Protected Route Access
   ```

2. **Inventory Management**:
   ```
   Admin UI → Inventory Form → API Request → 
   Backend Validation → Database Update → 
   WebSocket Broadcast → Real-time UI Update
   ```

3. **Order Processing**:
   ```
   Customer UI → Order Form → API Request → 
   Order Validation → Inventory Check → 
   Order Creation → Status Update → 
   Invoice Generation → Email Notification
   ```

### Sequence of Operations for Key Features

1. **Product Purchase**:
   - User browses products (Inventory.tsx)
   - User adds items to cart (client-side state)
   - User proceeds to checkout (Orders.tsx)
   - System validates inventory availability
   - System creates order record
   - System processes payment
   - System updates inventory
   - System generates invoice
   - System sends confirmation

2. **Inventory Restocking**:
   - Employee logs in with appropriate permissions
   - Employee accesses inventory management (EmployeeInventory.tsx)
   - Employee updates stock levels
   - System validates input
   - System updates database
   - System logs activity
   - Real-time updates broadcast to other users

### Error Handling Mechanisms

1. **Client-Side Validation**:
   - Form validation in React components
   - Error state management in context providers
   - User feedback through UI components

2. **API Request Validation**:
   - Input validation in `backend/middleware/validation.ts`
   - Request sanitization to prevent injection attacks
   - Appropriate HTTP status codes for different error types

3. **Database Error Handling**:
   - Transaction management for critical operations
   - Error logging in `backend/utils/logger.ts`
   - Graceful degradation with fallback options

4. **Authentication Errors**:
   - Token validation in `backend/middleware/auth.ts`
   - Session timeout handling
   - CSRF protection in `backend/middleware/csrf-protection.ts`

5. **Business Logic Errors**:
   - Inventory availability checks
   - Order status validation
   - Constraint enforcement through `backend/utils/validation.ts`

6. **Logging System**:
   - Secure logging implementation in `backend/utils/logger.ts`
   - Log sanitization to prevent injection attacks
   - Structured logging with context data
   - Error tracking with stack traces in development
   - Security event logging for authentication failures

7. **Error Recovery**:
   - Automatic retry mechanisms for batch operations

## 6. Security Implementation

1. **Authentication Security**:
   - Password hashing with Argon2id in `backend/utils/password.ts` (with fallback support for legacy bcrypt and PBKDF2)
   - Phantom token pattern implementation in `backend/utils/jwt.ts` and `backend/middleware/phantom-auth.ts`
   - Opaque tokens sent to client (not JWTs) to prevent token inspection and reduce attack surface
   - Internal short-lived JWTs (5 minutes) with issuer/audience validation
   - Dual authentication system combining phantom tokens with session-based authentication
   - CSRF protection in `backend/middleware/csrf-protection.ts`

2. **API Security**:
   - Tiered rate limiting in `backend/middleware/rate-limit.ts`:
     - General API rate limiting (1000 requests per 15 minutes)
     - Authentication rate limiting (100 requests per 15 minutes)
     - File upload rate limiting (10 uploads per minute)
     - Order creation rate limiting (50 orders per minute)
   - URL manipulation prevention in `backend/middleware/validation.ts`
   - Input validation and sanitization
   - Parameterized queries in `backend/utils/secure-query.ts`

3. **Data Protection**:
   - Sensitive data encryption
   - Secure session management in `backend/middleware/session-security.ts`
   - Proper error handling to prevent information leakage

## 7. Performance Optimization

1. **Backend Optimizations**:
   - Query optimization in `backend/utils/query-builder.ts`
   - Caching in `backend/middleware/cache.ts`
   - Batch processing in `backend/utils/batch-processor.ts`

2. **Frontend Optimizations**:
   - Component memoization
   - Lazy loading of routes
   - Efficient state management

3. **Database Optimizations**:
   - Proper indexing defined in `backend/utils/indexes.sql`
   - Query optimization in `backend/utils/run-optimizations.sql`
   - Connection pooling in `backend/db.ts`

## 8. Deployment and Environment Configuration

1. **Environment Setup**:
   - Environment variables in `envfiles/` directory
   - Production configuration in `ecosystem.config.cjs`
   - Build process defined in `vite.config.ts`

2. **Deployment Process**:
   - Build script in `package.json`
   - Production startup in `start-production.mjs`
   - Server configuration in `backend/server.js`

This document provides a comprehensive overview of the application's architecture, workflows, and technical components. It serves as a guide for understanding how the system functions from end to end.
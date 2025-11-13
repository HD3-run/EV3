-- Performance indexes for faster query execution
-- Run these manually in your database

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_merchant_id ON oms.users(merchant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON oms.users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON oms.users(role);

-- Products table indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_merchant_id ON oms.products(merchant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sku ON oms.products(sku);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category ON oms.products(merchant_id, category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_search ON oms.products USING gin(to_tsvector('english', product_name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_created_at ON oms.products(merchant_id, created_at DESC);

-- Inventory table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_merchant_id ON oms.inventory(merchant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_product_id ON oms.inventory(product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_sku ON oms.inventory(merchant_id, sku);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_low_stock ON oms.inventory(merchant_id, quantity_available, reorder_level);

-- Orders table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_merchant_id ON oms.orders(merchant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id ON oms.orders(merchant_id, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status ON oms.orders(merchant_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_source ON oms.orders(merchant_id, order_source);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON oms.orders(merchant_id, order_id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_id ON oms.orders(customer_id);

-- Order items table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON oms.order_items(order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id ON oms.order_items(product_id);

-- Customers table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_merchant_id ON oms.customers(merchant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_phone ON oms.customers(merchant_id, phone);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email ON oms.customers(merchant_id, email);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_inventory_join ON oms.products(product_id, merchant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_pagination ON oms.orders(merchant_id, order_id DESC, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_products_join ON oms.inventory(product_id, merchant_id, quantity_available, reorder_level);

-- CRITICAL NEW INDEXES FOR OPTIMIZED QUERIES
-- Payment status indexes for dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status ON oms.orders(merchant_id, payment_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_merchant_created_at ON oms.orders(merchant_id, created_at DESC);

-- Order items optimization for subqueries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_product ON oms.order_items(order_id, product_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_total_price ON oms.order_items(order_id, total_price);

-- Reports and analytics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_reports ON oms.orders(merchant_id, created_at, payment_status, total_amount);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_dashboard ON oms.orders(merchant_id, created_at DESC, status, payment_status);

-- Invoice optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_merchant_id ON oms.invoices(merchant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_order_id ON oms.invoices(order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_payment_status ON oms.invoices(merchant_id, payment_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_items_invoice_id ON oms.invoice_items(invoice_id);

-- Merchant billing details optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merchant_billing_merchant_id ON oms.merchant_billing_details(merchant_id);

-- Order payments optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_payments_order_id ON oms.order_payments(order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_payments_status ON oms.order_payments(order_id, status);
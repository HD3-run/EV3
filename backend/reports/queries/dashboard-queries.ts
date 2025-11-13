// Database queries for dashboard metrics

/**
 * Get today's orders and revenue
 */
export const getTodayOrdersQuery = (merchantId: number, date: string): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
      FROM oms.orders
      WHERE DATE(created_at) = $1 AND merchant_id = $2 AND status != 'returned'
    `,
    queryParams: [date, merchantId]
  };
};

/**
 * Get pending orders count
 */
export const getPendingOrdersQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COUNT(*) as count
      FROM oms.orders
      WHERE payment_status = 'pending' AND merchant_id = $1
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get low stock products count
 */
export const getLowStockQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COUNT(*) as count
      FROM oms.inventory i
      JOIN oms.products p ON i.product_id = p.product_id
      WHERE i.quantity_available <= i.reorder_level AND p.merchant_id = $1
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get total products and total stock
 */
export const getProductsAndStockQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT
        COUNT(*) as total_products,
        COALESCE(SUM(i.quantity_available), 0) as total_stock
      FROM oms.products p
      JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = $1
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get returns data
 */
export const getReturnsQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT 
        COUNT(*) as total_returns,
        COALESCE(SUM(total_refund_amount), 0) as total_return_amount
      FROM oms.order_returns
      WHERE merchant_id = $1
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get monthly revenue (last 12 months)
 */
export const getMonthlyRevenueQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT
        DATE_TRUNC('month', created_at) as month,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
      FROM oms.orders
      WHERE merchant_id = $1 
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
        AND payment_status = 'paid'
        AND status != 'returned'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get channel performance (last 30 days)
 */
export const getChannelPerformanceQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT
        order_source as channel,
        COUNT(*) as orders,
        SUM(total_amount) as revenue
      FROM oms.orders
      WHERE merchant_id = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND payment_status = 'paid'
        AND status != 'returned'
      GROUP BY order_source
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get adjusted COGS (excluding returned orders)
 */
export const getAdjustedCOGSQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COALESCE(SUM(oi.quantity * i.cost_price), 0) as total_cogs
      FROM oms.order_items oi
      JOIN oms.orders o ON oi.order_id = o.order_id
      JOIN oms.inventory i ON oi.inventory_id = i.inventory_id
      WHERE o.merchant_id = $1 
        AND o.payment_status = 'paid'
        AND o.status != 'returned'
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get top selling products (top 10)
 */
export const getTopProductsQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT 
        p.product_name,
        p.sku,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total_price) as revenue
      FROM oms.order_items oi
      JOIN oms.orders o ON oi.order_id = o.order_id
      JOIN oms.products p ON oi.product_id = p.product_id
      WHERE o.merchant_id = $1 
        AND o.payment_status = 'paid'
        AND o.status != 'returned'
      GROUP BY p.product_id, p.product_name, p.sku
      ORDER BY quantity_sold DESC
      LIMIT 10
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get debug dashboard data - orders count
 */
export const getDebugOrdersQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COUNT(*) as total_orders, COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders 
      FROM oms.orders 
      WHERE merchant_id = $1
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get debug dashboard data - products count
 */
export const getDebugProductsQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COUNT(*) as total_products 
      FROM oms.products 
      WHERE merchant_id = $1
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get debug dashboard data - low stock count
 */
export const getDebugLowStockQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COUNT(*) as low_stock_count
      FROM oms.inventory i
      JOIN oms.products p ON i.product_id = p.product_id
      WHERE i.quantity_available <= i.reorder_level AND p.merchant_id = $1
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get debug dashboard data - total stock
 */
export const getDebugTotalStockQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COALESCE(SUM(i.quantity_available), 0) as total_stock
      FROM oms.inventory i
      JOIN oms.products p ON i.product_id = p.product_id
      WHERE p.merchant_id = $1
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get debug dashboard data - today's orders
 */
export const getDebugTodayOrdersQuery = (merchantId: number, date: string): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT COUNT(*) as today_orders, COALESCE(SUM(total_amount), 0) as today_revenue
      FROM oms.orders
      WHERE DATE(created_at) = $1 AND merchant_id = $2
    `,
    queryParams: [date, merchantId]
  };
};


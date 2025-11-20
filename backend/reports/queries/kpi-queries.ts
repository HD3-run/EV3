// Database queries for KPI calculations

/**
 * Get total revenue and total orders for AOV calculation
 */
export const getRevenueAndOrdersQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM oms.orders
      WHERE merchant_id = $1 AND payment_status = 'paid' AND status != 'returned'
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get Cost of Goods Sold (COGS)
 */
export const getCOGSQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT 
        COALESCE(SUM(oi.quantity * i.cost_price), 0) as total_cogs
      FROM oms.order_items oi
      JOIN oms.orders o ON oi.order_id = o.order_id
      JOIN oms.inventory i ON oi.product_id = i.product_id
      WHERE o.merchant_id = $1 AND o.payment_status = 'paid' AND o.status != 'returned'
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get top selling products for KPIs (top 5)
 */
export const getTopProductsKPIQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT 
        pr.product_name,
        pr.sku,
        SUM(oi.quantity) as total_quantity_sold,
        SUM(oi.total_price) as total_revenue
      FROM oms.order_items oi
      JOIN oms.orders o ON oi.order_id = o.order_id
      JOIN oms.products pr ON oi.product_id = pr.product_id
      WHERE o.merchant_id = $1 AND o.payment_status = 'paid' AND o.status != 'returned'
      GROUP BY pr.product_id, pr.product_name, pr.sku
      ORDER BY total_quantity_sold DESC
      LIMIT 5
    `,
    queryParams: [merchantId]
  };
};

/**
 * Get top performing sales channels (top 5)
 */
export const getTopChannelsQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT 
        order_source as channel,
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        ROUND(AVG(total_amount), 2) as avg_order_value
      FROM oms.orders
      WHERE merchant_id = $1 AND payment_status = 'paid' AND status != 'returned'
      GROUP BY order_source
      ORDER BY total_revenue DESC
      LIMIT 5
    `,
    queryParams: [merchantId]
  };
};


// Database queries for order details used in invoice creation

/**
 * Get order details with customer state
 */
export const getOrderDetailsQuery = (
  orderId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT o.order_id, o.total_amount, o.customer_id, o.status, c.state_code as customer_state_code
      FROM oms.orders o 
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = $1 AND o.merchant_id = $2
    `,
    queryParams: [orderId, merchantId]
  };
};

/**
 * Get order items with product GST details
 */
export const getOrderItemsWithGstQuery = (orderId: number): { query: string; queryParams: any[] } => {
  return {
    query: `
      SELECT oi.order_item_id, oi.product_id, oi.inventory_id, oi.quantity, oi.price_per_unit, oi.total_price,
             p.hsn_code, p.gst_rate
      FROM oms.order_items oi 
      LEFT JOIN oms.products p ON oi.product_id = p.product_id
      WHERE oi.order_id = $1
    `,
    queryParams: [orderId]
  };
};


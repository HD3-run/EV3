// Order and order item queries for public orders

/**
 * Create new order
 */
export const createOrderQuery = (
  merchantId: number,
  customerId: number,
  orderSource: string,
  totalAmount: number
): { query: string; queryParams: any[] } => {
  const query = `
    INSERT INTO oms.orders (
      merchant_id, customer_id, order_source, total_amount, status
    ) VALUES ($1, $2, $3, $4, $5) 
    RETURNING *
  `;
  
  return {
    query,
    queryParams: [merchantId, customerId, orderSource, totalAmount, 'pending']
  };
};

/**
 * Create order item
 */
export const createOrderItemQuery = (orderItemData: {
  orderId: number;
  productId: number;
  inventoryId: number;
  sku: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
}): { query: string; queryParams: any[] } => {
  const query = `
    INSERT INTO oms.order_items (
      order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  
  return {
    query,
    queryParams: [
      orderItemData.orderId,
      orderItemData.productId,
      orderItemData.inventoryId,
      orderItemData.sku,
      orderItemData.quantity,
      orderItemData.pricePerUnit,
      orderItemData.totalPrice
    ]
  };
};

/**
 * Log initial order status to history
 */
export const logOrderStatusHistoryQuery = (
  orderId: number
): { query: string; queryParams: any[] } => {
  const query = `
    INSERT INTO oms.order_status_history (
      order_id, old_status, new_status, changed_by
    ) VALUES ($1, $2, $3, $4)
  `;
  
  return {
    query,
    queryParams: [orderId, null, 'pending', null]
  };
};


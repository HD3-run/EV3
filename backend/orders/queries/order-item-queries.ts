// Order item-related database queries

/**
 * Get order items for an order
 */
export const getOrderItems = (orderId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT order_item_id, product_id, inventory_id, quantity, price_per_unit, total_price 
    FROM oms.order_items 
    WHERE order_id = $1
  `;
  
  return { query, queryParams: [orderId] };
};

/**
 * Update order item prices
 */
export const updateOrderItemPrices = (
  orderId: number,
  pricePerUnit: number
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.order_items 
    SET price_per_unit = $1, total_price = (quantity::numeric * $1::numeric) 
    WHERE order_id = $2
  `;
  
  return { query, queryParams: [pricePerUnit, orderId] };
};

/**
 * Calculate total from order items
 */
export const calculateOrderTotal = (orderId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT COALESCE(SUM(total_price), 0) as new_total 
    FROM oms.order_items 
    WHERE order_id = $1
  `;
  
  return { query, queryParams: [orderId] };
};

/**
 * Update order total amount
 */
export const updateOrderTotal = (
  orderId: number,
  merchantId: number,
  totalAmount: number
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.orders 
    SET total_amount = $1, updated_at = CURRENT_TIMESTAMP 
    WHERE order_id = $2 AND merchant_id = $3
  `;
  
  return { query, queryParams: [totalAmount, orderId, merchantId] };
};

/**
 * Create order item
 */
export const createOrderItem = (
  orderId: number,
  productId: number,
  inventoryId: number | null,
  sku: string,
  quantity: number,
  pricePerUnit: number,
  totalPrice: number
): { query: string; queryParams: any[] } => {
  const query = `
    INSERT INTO oms.order_items (order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price) 
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
  
  return {
    query,
    queryParams: [orderId, productId, inventoryId, sku, quantity, pricePerUnit, totalPrice]
  };
};

/**
 * Batch create order items
 */
export const batchCreateOrderItems = (
  orderItems: Array<{
    orderId: number;
    productId: number;
    inventoryId: number | null;
    sku: string;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
  }>
): { query: string; queryParams: any[] } => {
  const itemValues = orderItems.map((_, index) => 
    `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
  ).join(', ');
  
  const itemParams = orderItems.flatMap(item => [
    item.orderId,
    item.productId,
    item.inventoryId,
    (item.sku || '').substring(0, 100),
    item.quantity,
    item.pricePerUnit,
    item.totalPrice
  ]);
  
  const query = `
    INSERT INTO oms.order_items (order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price) 
    VALUES ${itemValues}
  `;
  
  return { query, queryParams: itemParams };
};


// Return service - Business logic for order returns

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import * as orderQueries from '../queries/order-queries';
import * as productQueries from '../queries/product-queries';

export interface ReturnItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

/**
 * Create return request for an order
 */
export async function createReturnRequest(
  client: PoolClient,
  orderId: number,
  customerId: number,
  reason: string,
  returnItems: ReturnItem[],
  merchantId: number
) {
  // Check if order exists
  const orderQuery = orderQueries.checkOrderExists(orderId, merchantId);
  const orderResult = await client.query(orderQuery.query, orderQuery.queryParams);

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found');
  }

  const order = orderResult.rows[0];

  // Check if order is in valid state for return
  const validReturnStatuses = ['confirmed', 'delivered', 'assigned', 'shipped', 'cancelled'];
  if (!validReturnStatuses.includes(order.status)) {
    throw new Error(`Order cannot be returned. Current status: ${order.status}. Valid statuses: ${validReturnStatuses.join(', ')}`);
  }

  // Check if return already exists
  const existingReturn = await client.query(
    'SELECT return_id FROM oms.order_returns WHERE order_id = $1',
    [orderId]
  );

  if (existingReturn.rows.length > 0) {
    throw new Error('Return request already exists for this order');
  }

  // Calculate total return amount
  const totalReturnAmount = returnItems.reduce((sum: number, item: ReturnItem) => sum + item.total_amount, 0);

  // Create return record
  const returnResult = await client.query(
    `INSERT INTO oms.order_returns (
      order_id, customer_id, merchant_id, reason, total_refund_amount, 
      status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW()) 
    RETURNING return_id`,
    [orderId, customerId, merchantId, reason, totalReturnAmount]
  );

  const returnId = returnResult.rows[0].return_id;

  // Get order items for this order
  const orderItemsResult = await client.query(
    'SELECT order_item_id, product_id, inventory_id, quantity, price_per_unit, total_price FROM oms.order_items WHERE order_id = $1',
    [orderId]
  );

  if (orderItemsResult.rows.length === 0) {
    throw new Error('No order items found for this order');
  }

  // Insert return items
  for (const dbItem of orderItemsResult.rows) {
    const returnItem = returnItems.find(item => 
      item.product_id === dbItem.product_id || 
      item.product_id === parseInt(dbItem.product_id) ||
      parseInt(item.product_id.toString()) === parseInt(dbItem.product_id.toString())
    );
    
    if (returnItem) {
      const inventoryQuery = productQueries.getInventoryIdForProduct(merchantId, dbItem.product_id);
      const inventoryResult = await client.query(inventoryQuery.query, inventoryQuery.queryParams);
      const inventoryId = inventoryResult.rows.length > 0 ? inventoryResult.rows[0].inventory_id : null;

      await client.query(
        `INSERT INTO oms.order_return_items (
          return_id, order_item_id, product_id, inventory_id, 
          quantity, unit_price, total_amount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [returnId, dbItem.order_item_id, dbItem.product_id, inventoryId, 
         returnItem.quantity, returnItem.unit_price, returnItem.total_amount]
      );
    }
  }

  // Update order status to 'returned'
  await client.query(
    'UPDATE oms.orders SET status = $1, updated_at = NOW() WHERE order_id = $2',
    ['returned', orderId]
  );

  // Add status history entry
  await client.query(
    `INSERT INTO oms.order_status_history (
      order_id, old_status, new_status, changed_at
    ) VALUES ($1, $2, $3, NOW())`,
    [orderId, order.status, 'returned']
  );

  return {
    returnId,
    totalReturnAmount
  };
}


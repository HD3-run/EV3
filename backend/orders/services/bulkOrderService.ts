// Bulk order creation service - Business logic for bulk order creation

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import * as orderQueries from '../queries/order-queries';
import * as orderItemQueries from '../queries/order-item-queries';
import * as productQueries from '../queries/product-queries';

export interface BulkOrderItem {
  productId: number;
  sku?: string;
  quantity: number;
  unitPrice: number;
}

export interface BulkOrderRequest {
  channel: string;
  items: BulkOrderItem[];
  totalAmount?: number;
}

/**
 * Create bulk order with items
 */
export async function createBulkOrder(
  client: PoolClient,
  merchantId: number,
  userId: number,
  orderData: BulkOrderRequest
) {
  // Calculate the correct total amount as sum of all items (quantity * unitPrice)
  const orderTotalAmount = orderData.items.reduce(
    (sum: number, item: BulkOrderItem) => sum + (item.quantity * item.unitPrice),
    0
  );

  logger.info('Bulk order creation - total calculation', {
    itemsCount: orderData.items.length,
    items: orderData.items.map((item: BulkOrderItem) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      itemTotal: item.quantity * item.unitPrice
    })),
    calculatedTotalAmount: orderTotalAmount,
    providedTotalAmount: orderData.totalAmount
  });

  // Insert order
  const orderResult = await client.query(`
    INSERT INTO oms.orders (merchant_id, order_source, total_amount, status)
    VALUES ($1, $2, $3, 'pending')
    RETURNING *
  `, [merchantId, orderData.channel, orderTotalAmount]);

  const order = orderResult.rows[0];

  // Insert order items
  for (const item of orderData.items) {
    // Get inventory_id for this product
    const inventoryResult = await client.query(
      'SELECT inventory_id FROM oms.inventory WHERE product_id = $1 AND merchant_id = $2',
      [item.productId, merchantId]
    );
    
    const inventoryId = inventoryResult.rows.length > 0 ? inventoryResult.rows[0].inventory_id : null;
    
    const calculatedTotalPrice = item.quantity * item.unitPrice;
    await client.query(`
      INSERT INTO oms.order_items (order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [order.order_id, item.productId, inventoryId, item.sku || 'SKU', item.quantity, item.unitPrice, calculatedTotalPrice]);

    // Update inventory
    await client.query(`
      UPDATE oms.inventory 
      SET quantity_available = quantity_available - $1
      WHERE product_id = $2 AND merchant_id = $3
    `, [item.quantity, item.productId, merchantId]);
  }

  // Log initial order status to history table
  await client.query(
    'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
    [order.order_id, null, 'pending', userId]
  );

  // Get the complete order data with customer info like the orders list API
  const completeOrderQuery = orderQueries.getCompleteOrderQuery(order.order_id, merchantId);
  const completeOrderResult = await client.query(completeOrderQuery.query, completeOrderQuery.queryParams);

  const completeOrder = completeOrderResult.rows[0];

  logger.info('Order created successfully', {
    orderId: order.order_id,
    customerName: completeOrder.customer_name,
    displayAmount: completeOrder.display_amount
  });

  return completeOrder;
}


// Assignment service - Business logic for order assignment

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';

/**
 * Assign order to employee
 */
export async function assignOrderToEmployee(
  client: PoolClient,
  orderId: number,
  merchantId: number,
  userId: number,
  assignedUserId: number
) {
  // Get current order status
  const currentOrder = await client.query(
    'SELECT status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
    [orderId, merchantId]
  );

  if (currentOrder.rows.length === 0) {
    throw new Error('Order not found');
  }

  const oldStatus = currentOrder.rows[0].status;

  // Update order with assigned user - DO NOT change status, just assign the user
  // Assignment is independent of status - can assign at any status level
  // Status remains unchanged (e.g., if status is "confirmed", it stays "confirmed")
  await client.query(
    'UPDATE oms.orders SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3',
    [assignedUserId, orderId, merchantId]
  );

  // Log assignment as a special event - don't change status, just track assignment
  // Use a special format: old_status = "assignment:{user_id}", new_status = current status
  // This way assignment doesn't appear as a status change
  await client.query(
    'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
    [orderId, `assignment:${assignedUserId}`, oldStatus, userId]
  );

  logger.info('Order assigned to user', { orderId, assignedUserId, assignedBy: userId, statusRemains: oldStatus });

  return { orderId, assignedUserId, oldStatus, newStatus: oldStatus };
}


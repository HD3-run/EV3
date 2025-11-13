// Status update service - Business logic for order status updates

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import { ORDER_STATUS } from '../../utils/constants';

/**
 * Update order status with validation
 */
export async function updateOrderStatus(
  client: PoolClient,
  orderId: number,
  merchantId: number,
  userId: number,
  newStatus: string
) {
  // Validate status value using constants
  const validStatuses = Object.values(ORDER_STATUS);
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Get current status
  const currentOrder = await client.query(
    'SELECT status, payment_status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2',
    [orderId, merchantId]
  );

  if (currentOrder.rows.length === 0) {
    throw new Error('Order not found');
  }

  const oldStatus = currentOrder.rows[0].status;
  const paymentStatus = currentOrder.rows[0].payment_status;

  // Import status validation utilities for admin
  const { isValidEmployeeStatusTransition, getAllowedStatusTransitions } = await import('../../utils/status-validation');

  // Validate status transition using business rules (same as employees)
  if (!isValidEmployeeStatusTransition(oldStatus, newStatus)) {
    const allowedTransitions = getAllowedStatusTransitions(oldStatus);
    throw new Error(
      `Invalid status transition from '${oldStatus}' to '${newStatus}'. Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (final status)'}`
    );
  }

  // Prevent setting status to 'confirmed' unless payment is made
  if (newStatus === 'confirmed' && paymentStatus !== 'paid') {
    throw new Error('Please mark the order as paid first before confirming');
  }

  // Prevent setting status to 'shipped' unless payment is made
  if (newStatus === 'shipped' && paymentStatus !== 'paid') {
    throw new Error('Please mark the order as paid first before shipping');
  }

  // Prevent setting status to 'delivered' unless payment is made
  if (newStatus === 'delivered' && paymentStatus !== 'paid') {
    throw new Error('Please mark the order as paid first before marking as delivered');
  }

  // Prevent setting status to 'cancelled' unless payment is made
  if (newStatus === 'cancelled' && paymentStatus !== 'paid') {
    throw new Error('Please mark the order as paid first before cancelling');
  }

  // Update order status
  await client.query(
    'UPDATE oms.orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3',
    [newStatus, orderId, merchantId]
  );

  // Log status change
  await client.query(
    'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
    [orderId, oldStatus, newStatus, userId]
  );

  logger.info('Order status updated by admin', { orderId, newStatus, userId });

  return { oldStatus, newStatus };
}


// Employee status update service with role-based validation

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import { ORDER_STATUS, OrderStatus } from '../../utils/constants';

/**
 * Role-based status transition validation
 */
function isRoleBasedTransitionAllowed(role: string, fromStatus: string, toStatus: string): boolean {
  // NO USER can change status to 'pending'
  if (toStatus === 'pending') {
    return false;
  }
  
  // Admin can change any status to any other status (except pending)
  if (role === 'admin') {
    return true;
  }
  
  // 'delivered' is final status for all roles - cannot change from delivered
  if (fromStatus === 'delivered') {
    return false;
  }
  
  // Delivery role permissions - can ONLY change shipped → delivered
  // Can also change from assigned → delivered directly
  // NO cancelled option for Delivery role
  if (role === 'Delivery') {
    // Block cancelled for Delivery
    if (toStatus === 'cancelled') {
      return false;
    }
    if (fromStatus === 'shipped' && toStatus === 'delivered') {
      return true;
    }
    if (fromStatus === 'assigned' && toStatus === 'delivered') {
      return true;
    }
    return false;
  }
  
  // Shipment role permissions - can ONLY change confirmed → shipped (shipped is final for them)
  // Can also change from assigned → shipped directly
  // NO cancelled option for Shipment role
  // Shipment should ONLY see 'shipped' status option
  if (role === 'Shipment') {
    // Block cancelled for Shipment
    if (toStatus === 'cancelled') {
      return false;
    }
    if (fromStatus === 'confirmed' && toStatus === 'shipped') {
      return true;
    }
    if (fromStatus === 'assigned' && toStatus === 'shipped') {
      return true;
    }
    // Cannot change from shipped (it's their final state)
    if (fromStatus === 'shipped') {
      return false;
    }
    return false;
  }
  
  // Employee role permissions - can only move forward in status flow, not backwards
  // Status flow: pending → confirmed → shipped → delivered
  // Cannot go backwards (e.g., shipped → confirmed) or to returned/cancelled/pending
  // Cannot change from returned or cancelled orders (final states)
  if (role === 'Employee') {
    // Returned and cancelled are final states - cannot change from them
    if (fromStatus === 'returned' || fromStatus === 'cancelled') {
      return false;
    }
    // Cannot change to returned, cancelled, or pending
    if (toStatus === 'returned' || toStatus === 'cancelled' || toStatus === 'pending') {
      return false;
    }
    // Define status order to prevent backwards transitions
    const statusOrder = ['pending', 'confirmed', 'shipped', 'delivered'];
    const fromIndex = statusOrder.indexOf(fromStatus);
    const toIndex = statusOrder.indexOf(toStatus);
    
    // If both statuses are in the order, prevent backwards transitions
    if (fromIndex !== -1 && toIndex !== -1 && toIndex < fromIndex) {
      return false; // Backwards transition not allowed
    }
    // Allow forward transitions or transitions involving 'assigned' status
    return true;
  }
  
  // For any other role (should not happen with proper validation)
  return false;
}

/**
 * Update order status for employee (with role-based validation)
 */
export async function updateEmployeeOrderStatus(
  client: PoolClient,
  orderId: number,
  userId: number,
  newStatus: string,
  userRole: string
) {
  // Validate status value
  const validStatuses = Object.values(ORDER_STATUS) as OrderStatus[];
  if (!validStatuses.includes(newStatus as OrderStatus)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Get current order status
  const orderResult = await client.query(
    'SELECT status, payment_status FROM oms.orders WHERE order_id = $1 AND user_id = $2',
    [orderId, userId]
  );
  
  if (orderResult.rows.length === 0) {
    throw new Error('Order not found or not assigned to you');
  }
  
  const oldStatus = orderResult.rows[0].status;
  const paymentStatus = orderResult.rows[0].payment_status;
  
  logger.info('Status update details', { orderId, oldStatus, newStatus, paymentStatus, userRole });
  
  // Validate role-based transition
  if (!isRoleBasedTransitionAllowed(userRole, oldStatus, newStatus)) {
    const { getAllowedStatusTransitions } = await import('../../utils/status-validation');
    const allowedTransitions = getAllowedStatusTransitions(oldStatus);
    throw new Error(
      `Invalid status transition from '${oldStatus}' to '${newStatus}' for role '${userRole}'. Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (final status)'}`
    );
  }
  
  // Payment validation
  const { requiresPaymentValidation } = await import('../../utils/status-validation');
  if (requiresPaymentValidation(newStatus) && paymentStatus !== 'paid') {
    throw new Error(`Please mark the order as paid first before changing to '${newStatus}'`);
  }
  
  // Update order status
  await client.query(
    'UPDATE oms.orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND user_id = $3',
    [newStatus, orderId, userId]
  );
  
  // Log status change
  await client.query(
    'INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
    [orderId, oldStatus, newStatus, userId]
  );
  
  logger.info('Order status updated by employee', { orderId, newStatus, userId, userRole });
  
  return { oldStatus, newStatus };
}


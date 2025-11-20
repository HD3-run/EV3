/**
 * Status validation utilities for order management
 */

import { ORDER_STATUS } from './constants';

export interface StatusTransitionRule {
  from: string;
  to: string[];
  requiresPayment?: boolean;
}

/**
 * Define valid status transitions for employees
 * This prevents employees from making invalid status changes
 */
export const EMPLOYEE_STATUS_TRANSITIONS: StatusTransitionRule[] = [
  {
    from: ORDER_STATUS.PENDING,
    to: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED]
  },
  {
    from: ORDER_STATUS.CONFIRMED,
    to: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED]
  },
  {
    from: ORDER_STATUS.SHIPPED,
    to: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED]
  },
  // Final states - no transitions allowed
  {
    from: ORDER_STATUS.DELIVERED,
    to: [] // Cannot change from delivered
  },
  {
    from: ORDER_STATUS.CANCELLED,
    to: [] // Cannot change from cancelled
  },
  {
    from: ORDER_STATUS.RETURNED,
    to: [] // Cannot change from returned
  }
];

/**
 * Validate if a status transition is allowed for employees
 */
export function isValidEmployeeStatusTransition(currentStatus: string, newStatus: string): boolean {
  // Employees cannot change returned orders
  if (currentStatus === ORDER_STATUS.RETURNED) {
    return false;
  }
  
  const rule = EMPLOYEE_STATUS_TRANSITIONS.find(r => r.from === currentStatus);
  if (!rule) {
    return false;
  }
  return rule.to.includes(newStatus);
}

/**
 * Get allowed status transitions for a given current status
 */
export function getAllowedStatusTransitions(currentStatus: string): string[] {
  const rule = EMPLOYEE_STATUS_TRANSITIONS.find(r => r.from === currentStatus);
  return rule ? rule.to : [];
}

/**
 * Check if a status requires payment validation
 */
export function requiresPaymentValidation(status: string): boolean {
  return status === ORDER_STATUS.CONFIRMED || status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.CANCELLED;
}
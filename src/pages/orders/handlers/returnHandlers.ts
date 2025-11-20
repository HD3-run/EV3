// Return-related handlers

import { getApiUrl } from '../../../config/api';
import type { Order } from '../types/order.types';

export interface ReturnData {
  reason: string;
  returnItems: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }>;
}

export interface ReturnCallbacks {
  loadOrdersWrapper: () => Promise<void>;
  setShowReturnModal: (show: boolean) => void;
  setReturnData: (data: ReturnData) => void;
  setSelectedOrder: (order: Order | null) => void;
}

/**
 * Submit return request
 */
export async function submitReturn(
  selectedOrder: Order | null,
  returnData: ReturnData,
  callbacks: ReturnCallbacks
): Promise<void> {
  if (!selectedOrder || !returnData.reason.trim()) return;

  try {
    const response = await fetch(getApiUrl('/api/orders/return'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        order_id: selectedOrder.id,
        customer_id: selectedOrder.customerId.replace('CUS', ''),
        reason: returnData.reason,
        return_items: returnData.returnItems
      }),
    });

    if (response.ok) {
      // Refresh orders list
      await callbacks.loadOrdersWrapper();
      alert('Return request submitted successfully!');
      callbacks.setShowReturnModal(false);
      callbacks.setReturnData({ reason: '', returnItems: [] });
      callbacks.setSelectedOrder(null);
    } else {
      const errorData = await response.json();
      alert(`Failed to submit return: ${errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error submitting return:', error);
    alert('Failed to submit return request');
  }
}

/**
 * Handle return button click
 */
export function handleReturnClick(
  order: Order,
  callbacks: {
    setSelectedOrder: (order: Order) => void;
    setReturnData: (data: ReturnData) => void;
    setShowReturnModal: (show: boolean) => void;
  }
): void {
  callbacks.setSelectedOrder(order);
  const returnItems = order.order_items?.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.price_per_unit,
    total_amount: item.quantity * item.price_per_unit
  })) || [];
  callbacks.setReturnData({ reason: '', returnItems });
  callbacks.setShowReturnModal(true);
}

/**
 * Handle return order - validates payment status before allowing return
 */
export function handleReturnOrder(
  order: Order,
  callbacks: {
    handleReturnClick: (order: Order) => void;
  }
): void {
  // Check if payment is pending - cannot return unpaid orders (except for cancelled orders)
  if (order.paymentStatus === 'pending' && order.status !== 'cancelled') {
    alert('Cannot return unpaid orders. Please ensure the order is paid before processing a return.');
    return;
  }
  
  callbacks.handleReturnClick(order);
}

export interface AssignmentCallbacks {
  setShowAssignModal: (show: boolean) => void;
  setSelectedOrder: (order: Order | null) => void;
  setAssignmentData: (data: { userId: string; deliveryNotes: string }) => void;
  loadOrdersWrapper: () => Promise<void>;
}

/**
 * Handle assign order - opens assignment modal
 */
export function handleAssignOrder(_order: Order): void {
  // This function is intentionally empty - the modal opening is handled in Orders.tsx
  // This function exists for consistency with other handlers
}

// Debounce state to prevent rapid-fire assignment requests
let assignmentDebounceTimer: NodeJS.Timeout | null = null;
let isAssignmentInProgress = false;

/**
 * Submit assignment to backend with debouncing
 */
export async function submitAssignment(
  order: Order | null,
  assignmentData: { userId: string; deliveryNotes: string },
  callbacks: AssignmentCallbacks
): Promise<void> {
  if (!order || !assignmentData.userId) {
    alert('Please select an employee to assign the order to.');
    return;
  }

  // Prevent multiple simultaneous requests
  if (isAssignmentInProgress) {
    console.log('Assignment already in progress, ignoring duplicate request');
    return;
  }

  // Clear any existing debounce timer
  if (assignmentDebounceTimer) {
    clearTimeout(assignmentDebounceTimer);
  }

  // Debounce: wait 300ms before making the request
  // This prevents rapid-fire clicks from causing multiple requests
  return new Promise((resolve) => {
    assignmentDebounceTimer = setTimeout(async () => {
      isAssignmentInProgress = true;
      assignmentDebounceTimer = null;

      try {
        const response = await fetch(getApiUrl('/api/orders/assign'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            orderId: parseInt(order.id, 10),
            userId: parseInt(assignmentData.userId, 10),
            deliveryNotes: assignmentData.deliveryNotes || ''
          }),
        });

        if (response.ok) {
          // Refresh orders list
          await callbacks.loadOrdersWrapper();
          alert('Order assigned successfully!');
          callbacks.setShowAssignModal(false);
          callbacks.setSelectedOrder(null);
          callbacks.setAssignmentData({ userId: '', deliveryNotes: '' });
        } else {
          const errorData = await response.json();
          alert(`Failed to assign order: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error assigning order:', error);
        alert('Failed to assign order');
      } finally {
        isAssignmentInProgress = false;
        resolve();
      }
    }, 300); // 300ms debounce delay
  });
}


// Order-related handlers

import { getApiUrl } from '../../../config/api';
import { formatCurrency } from '../../../utils/currency';
import { validateForm } from '../utils/validation';
import type { Order, OrderFormData, FormErrors } from '../types/order.types';

export interface AddOrderCallbacks {
  setFormErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setShowAddOrderModal: (show: boolean) => void;
  setNewOrder: React.Dispatch<React.SetStateAction<OrderFormData>>;
  setManualProductId: (id: string) => void;
  setProductIdError: (error: string) => void;
  setIsValidatingProductId: (validating: boolean) => void;
  loadTotalOrdersWrapper: () => Promise<void>;
}

/**
 * Handle adding a new order
 */
export async function handleAddOrder(
  newOrder: OrderFormData,
  callbacks: AddOrderCallbacks
): Promise<void> {
  // Validate form before submission
  const validationResult = validateForm(newOrder);
  if (!validationResult.isValid) {
    callbacks.setFormErrors(validationResult.errors);
    return;
  }

  callbacks.setFormErrors({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: '',
    alternatePhone: '',
    deliveryNote: '',
    productName: ''
  });

  try {
    const response = await fetch(getApiUrl('/api/orders/add-manual'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(newOrder)
    });

    if (response.ok) {
      const addedOrder = await response.json();

      // Add the new order to local state instead of reloading all orders
      const formattedOrder: Order = {
        id: addedOrder.order_id.toString(),
        orderId: `ORD${addedOrder.order_id}`,
        customerId: `CUS${addedOrder.customer_id}`,
        customerName: addedOrder.customer_name || 'Unknown',
        amount: parseFloat(addedOrder.display_amount) || 0,
        status: addedOrder.status || 'pending',
        date: new Date(addedOrder.order_date || addedOrder.created_at).toISOString().split('T')[0],
        channel: addedOrder.order_source || 'Unknown',
        type: 'Standard',
        customer: addedOrder.customer_name || 'Unknown',
        paymentStatus: addedOrder.payment_status || 'pending',
        user_id: addedOrder.user_id,
        order_items: addedOrder.order_items || [
          {
            order_item_id: 0,
            product_id: 0,
            product_name: newOrder.productName,
            quantity: newOrder.quantity,
            price_per_unit: newOrder.unitPrice,
            total_price: newOrder.quantity * newOrder.unitPrice,
            sku: 'SKU'
          }
        ]
      };

      callbacks.setOrders(prevOrders => [formattedOrder, ...prevOrders]);

      // Close modal first, then show success message
      callbacks.setShowAddOrderModal(false);
      callbacks.setNewOrder({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        addressLine1: '',
        addressLine2: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        alternatePhone: '',
        isVerifiedAddress: false,
        deliveryNote: '',
        productName: '',
        productId: '',
        quantity: 0,
        unitPrice: 0,
        orderSource: 'Manual',
        state_code: '',
        gst_number: ''
      });

      // Clear product selection state
      callbacks.setManualProductId('');
      callbacks.setProductIdError('');
      callbacks.setIsValidatingProductId(false);

      // Clear form errors
      callbacks.setFormErrors({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        addressLine1: '',
        addressLine2: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        country: '',
        alternatePhone: '',
        deliveryNote: '',
        productName: ''
      });

      // Refresh total orders count
      await callbacks.loadTotalOrdersWrapper();

      // Show success message after modal is closed
      setTimeout(() => {
        alert(`Order added successfully!\n\nOrder ID: ${formattedOrder.orderId}\nCustomer: ${formattedOrder.customerName}\nProduct: ${newOrder.productName}\nTotal: ${formatCurrency(formattedOrder.amount)}`);
      }, 100);
    } else {
      const errorData = await response.json();
      if (response.status === 401) {
        alert('Session expired. Please log in again.');
        window.location.href = '/login';
      } else {
        alert(`Failed to add order: ${errorData.message || 'Unknown error'}`);
      }
    }
  } catch (error) {
    alert('Failed to add order: Network error');
  }
}

export interface StatusUpdateCallbacks {
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  loadOrders?: () => Promise<void>;
}

/**
 * Handle order status update
 */
export async function handleStatusUpdate(
  orderId: string,
  newStatus: string,
  orders: Order[],
  userRole: string,
  callbacks: StatusUpdateCallbacks
): Promise<void> {
  // Find the order to check payment status
  const order = orders.find(o => o.id === orderId);

  if (!order) {
    alert('Order not found');
    return;
  }

  const currentStatus = order.status;

  // Validate role-based status transitions on frontend
  const isRoleBasedTransitionAllowed = (role: string, fromStatus: string, toStatus: string): boolean => {
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
      if (fromStatus === 'shipped') {
        return false; // Cannot change from shipped (it's their final state)
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

    return false;
  };

  // Validate status transition
  if (!isRoleBasedTransitionAllowed(userRole, currentStatus, newStatus)) {
    let errorMessage = `Invalid status transition from '${currentStatus}' to '${newStatus}' for your role.`;
    if (userRole === 'Delivery') {
      errorMessage += ' You can only change status from "shipped" to "delivered".';
    } else if (userRole === 'Shipment') {
      errorMessage += ' You can only change status from "confirmed" to "shipped".';
    } else if (userRole === 'Employee') {
      errorMessage += ' You cannot change status to "returned" or "cancelled".';
    }
    alert(errorMessage);
    return;
  }

  // Prevent setting status to 'delivered' unless order is paid
  if (newStatus === 'delivered' && order.paymentStatus !== 'paid') {
    alert('Cannot mark order as delivered until payment is received. Please mark the order as paid first.');
    return;
  }

  // Prevent setting status to 'cancelled' unless order is paid
  if (newStatus === 'cancelled' && order.paymentStatus !== 'paid') {
    alert('Cannot cancel order until payment is received. Please mark the order as paid first.');
    return;
  }

  // Prevent setting status to 'assigned' via dropdown - must use Assign button
  if (newStatus === 'assigned' && order.status !== 'assigned') {
    alert('Please use the "Assign" button to assign orders to employees. This will open the employee selection modal.');
    return;
  }

  try {
    const endpoint = userRole === 'admin'
      ? `/api/orders/${orderId}/status`
      : `/api/employee/orders/${orderId}/status`;

    const method = userRole === 'admin' ? 'PATCH' : 'PUT';

    const response = await fetch(getApiUrl(endpoint), {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ status: newStatus })
    });

    if (response.ok) {
      // Update local state immediately for better UX
      callbacks.setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      // Note: If additional data is needed (like assignment info), 
      // it should be included in the API response, not fetched separately
    } else {
      const errorData = await response.json();
      alert(errorData.message || 'Failed to update order status');
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    alert('Network error occurred');
  }
}


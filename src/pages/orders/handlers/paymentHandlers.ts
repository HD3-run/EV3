// Payment-related handlers

import { getApiUrl } from '../../../config/api';
import type { Order } from '../types/order.types';

export interface PaymentUpdateParams {
  orderId: number;
  paymentStatus: string;
  paymentMethod?: string;
  amount?: number;
  pricePerUnit?: number;
}

export interface PaymentUpdateCallbacks {
  setUpdatingOrderId: (id: number | null) => void;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setTotalRevenue: React.Dispatch<React.SetStateAction<number>>;
  setPendingOrders: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Update payment status for an order
 */
export async function handlePaymentUpdate(
  params: PaymentUpdateParams,
  callbacks: PaymentUpdateCallbacks
): Promise<void> {
  const { orderId, paymentStatus, paymentMethod = 'cash', amount, pricePerUnit } = params;
  const { setUpdatingOrderId, setOrders, setTotalRevenue, setPendingOrders } = callbacks;

  console.log('🔄 Starting payment update for order:', orderId, { paymentStatus, paymentMethod, pricePerUnit });

  setUpdatingOrderId(orderId);

  try {
    const response = await fetch(getApiUrl(`/api/orders/${orderId}/payment`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        status: paymentStatus,
        paymentMethod: paymentMethod,
        amount: amount,
        pricePerUnit: pricePerUnit
      })
    });

    console.log('📡 API Response status:', response.status);

    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ API Response data:', responseData);

      // Update local state with both payment status and price_per_unit if provided
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map(order => {
          if (order.id === orderId.toString()) {
            const updatedOrder = {
              ...order,
              paymentStatus: paymentStatus,
              ...(paymentStatus === 'paid' && order.status !== 'cancelled' && { status: 'confirmed' }),
              ...(pricePerUnit !== undefined && {
                order_items: order.order_items?.map(item => ({
                  ...item,
                  price_per_unit: pricePerUnit
                }))
              }),
              ...(responseData.newTotalAmount !== undefined && {
                amount: parseFloat(responseData.newTotalAmount)
              })
            };
            return updatedOrder;
          }
          return order;
        });
        return updatedOrders;
      });

      // Update metrics immediately after successful payment update
      if (paymentStatus === 'paid') {
        setTotalRevenue(prevRevenue => {
          const orderAmount = responseData.newTotalAmount || amount || 0;
          return prevRevenue + parseFloat(orderAmount);
        });
        setPendingOrders(prevPending => Math.max(0, prevPending - 1));
      } else if (paymentStatus === 'pending') {
        setTotalRevenue(prevRevenue => {
          const orderAmount = amount || 0;
          return Math.max(0, prevRevenue - orderAmount);
        });
        setPendingOrders(prevPending => prevPending + 1);
      }

      // Check if invoice creation failed and show warning
      if (responseData.invoiceCreationFailed) {
        alert(`Payment updated successfully, but invoice creation failed: ${responseData.invoiceCreationError}\n\nPlease set up your billing details in Settings to enable automatic invoice creation.`);
      }
    } else {
      const errorData = await response.json();
      console.error('❌ API Error:', errorData);
      alert(`Failed to update payment: ${errorData.message}`);
    }
  } catch (error) {
    console.error('💥 Network error:', error);
    alert('Failed to update payment status');
  } finally {
    setUpdatingOrderId(null);
  }
}

/**
 * Handle payment button click - opens modal for 'paid' status or directly updates for other statuses
 */
export function handlePaymentClick(
  order: Order,
  status: string,
  callbacks: {
    setSelectedPaymentOrder: (order: Order | null) => void;
    setPaymentData: (data: { pricePerUnit: number; paymentMethod: string }) => void;
    setShowPaymentModal: (show: boolean) => void;
    handlePaymentUpdate: (orderId: number, status: string) => void;
  }
): void {
  if (status === 'paid') {
    callbacks.setSelectedPaymentOrder(order);
    // Get current price_per_unit from order items
    const currentPricePerUnit = order.order_items && order.order_items.length > 0
      ? order.order_items[0].price_per_unit
      : 0;
    callbacks.setPaymentData({ pricePerUnit: currentPricePerUnit, paymentMethod: 'cash' });
    callbacks.setShowPaymentModal(true);
  } else {
    callbacks.handlePaymentUpdate(parseInt(order.id, 10), status);
  }
}

/**
 * Submit payment from modal
 */
export async function submitPayment(
  selectedPaymentOrder: Order | null,
  paymentData: { pricePerUnit: number; paymentMethod: string },
  callbacks: {
    setIsUpdatingPayment: (updating: boolean) => void;
    handlePaymentUpdate: (orderId: number, status: string, paymentMethod: string, amount: number | undefined, pricePerUnit: number) => Promise<void>;
    setShowPaymentModal: (show: boolean) => void;
    setSelectedPaymentOrder: (order: Order | null) => void;
    setPaymentData: (data: { pricePerUnit: number; paymentMethod: string }) => void;
  }
): Promise<void> {
  if (!selectedPaymentOrder) {
    console.log('❌ No selected payment order');
    return;
  }

  console.log('🎯 Selected payment order:', selectedPaymentOrder.id, 'amount:', selectedPaymentOrder.amount);

  callbacks.setIsUpdatingPayment(true);

  try {
    await callbacks.handlePaymentUpdate(
      parseInt(selectedPaymentOrder.id, 10),
      'paid',
      paymentData.paymentMethod,
      undefined,
      paymentData.pricePerUnit
    );

    console.log('⏰ Waiting before closing modal...');

    // Small delay to let user see the updated values before closing modal
    setTimeout(() => {
      console.log('🔒 Closing payment modal');
      callbacks.setShowPaymentModal(false);
      callbacks.setSelectedPaymentOrder(null);
      callbacks.setPaymentData({ pricePerUnit: 0, paymentMethod: 'cash' });
      callbacks.setIsUpdatingPayment(false);
    }, 800);

  } catch (error) {
    console.error('💥 Payment update failed:', error);
    callbacks.setIsUpdatingPayment(false);
  }
}


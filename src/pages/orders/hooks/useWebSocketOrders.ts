// Custom hook for WebSocket order updates

import { useEffect, useRef } from 'react';
import type { Order } from '../types/order.types';

interface UseWebSocketOrdersProps {
  isConnected: boolean;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setTotalRevenue: React.Dispatch<React.SetStateAction<number>>;
  setPendingOrders: React.Dispatch<React.SetStateAction<number>>;
  loadMetricsWrapper: () => Promise<void>;
  loadOrdersWrapper: () => Promise<void>;
}

export function useWebSocketOrders({
  isConnected,
  setOrders,
  setTotalRevenue,
  setPendingOrders,
  loadMetricsWrapper,
  loadOrdersWrapper
}: UseWebSocketOrdersProps) {
  // Track orders currently being updated to prevent race conditions
  const updatingOrdersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isConnected) return;

    const handleOrderStatusUpdate = (data: any) => {
      console.log('📡 WebSocket order status update received:', data);

      // If it's a payment status update, update the specific order in local state
      if (data.paymentStatus && data.orderId) {
        const orderIdStr = data.orderId.toString();

        // Prevent race condition: skip if this order is already being updated
        if (updatingOrdersRef.current.has(orderIdStr)) {
          console.log('⏭️ Skipping WebSocket update - order already being updated:', orderIdStr);
          return;
        }

        // Mark order as updating
        updatingOrdersRef.current.add(orderIdStr);
        console.log('💳 Updating payment status via WebSocket for order:', data.orderId);

        setOrders(prevOrders => {
          const updatedOrders = prevOrders.map(order => {
            if (order.id === data.orderId.toString()) {
              console.log('🔄 WebSocket updating order:', order.id, 'payment status:', order.paymentStatus, '→', data.paymentStatus);
              return {
                ...order,
                paymentStatus: data.paymentStatus,
                ...(data.newTotalAmount !== undefined && {
                  amount: parseFloat(data.newTotalAmount)
                })
              };
            }
            return order;
          });
          return updatedOrders;
        });

        // Update metrics immediately based on the payment status change
        if (data.paymentStatus === 'paid') {
          console.log('💰 Payment confirmed - updating revenue metrics');
          setTotalRevenue(prevRevenue => {
            const orderAmount = data.newTotalAmount || data.originalTotalAmount || 0;
            const newRevenue = prevRevenue + parseFloat(orderAmount);
            console.log('💰 Revenue updated:', prevRevenue, '→', newRevenue);
            return newRevenue;
          });
          setPendingOrders(prevPending => {
            const newPending = Math.max(0, prevPending - 1);
            console.log('⏳ Pending orders updated:', prevPending, '→', newPending);
            return newPending;
          });
        } else if (data.paymentStatus === 'pending') {
          console.log('⏳ Payment reverted to pending - updating metrics');
          setTotalRevenue(prevRevenue => {
            const orderAmount = data.originalTotalAmount || 0;
            const newRevenue = Math.max(0, prevRevenue - parseFloat(orderAmount));
            console.log('💰 Revenue updated:', prevRevenue, '→', newRevenue);
            return newRevenue;
          });
          setPendingOrders(prevPending => {
            const newPending = prevPending + 1;
            console.log('⏳ Pending orders updated:', prevPending, '→', newPending);
            return newPending;
          });
        }

        // Also reload metrics to ensure accuracy (as backup)
        setTimeout(() => {
          console.log('🔄 Reloading metrics as backup after payment update');
          loadMetricsWrapper();
          // Clear the updating flag after metrics reload
          updatingOrdersRef.current.delete(orderIdStr);
        }, 1000);
      } else {
        // For other status updates, refresh all orders and metrics
        console.log('🔄 Refreshing all orders and metrics due to status update');
        loadOrdersWrapper();
        loadMetricsWrapper();
      }
    };

    // Access the socket from the global io object
    const socket = (window as any).io;
    if (socket && socket.connected) {
      socket.on('order-status-updated', handleOrderStatusUpdate);

      return () => {
        socket.off('order-status-updated', handleOrderStatusUpdate);
      };
    }
  }, [isConnected, setOrders, setTotalRevenue, setPendingOrders, loadMetricsWrapper, loadOrdersWrapper]);
}


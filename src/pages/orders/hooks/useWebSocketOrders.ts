// Custom hook for WebSocket order updates

import { useEffect } from 'react';
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
  useEffect(() => {
    if (!isConnected) return;

    const handleOrderStatusUpdate = async (data: any) => {
      console.log('📡 WebSocket order status update received:', data);

      // If it's a payment status update, update the specific order in local state
      if (data.paymentStatus && data.orderId) {
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

        // Reload metrics from server to ensure accuracy (no optimistic updates to avoid race conditions)
        console.log('🔄 Reloading metrics after payment update');
        try {
          await loadMetricsWrapper();
        } catch (error) {
          console.error('❌ Failed to reload metrics after payment update:', error);
        }
      } else {
        // For other status updates, refresh all orders and metrics
        console.log('🔄 Refreshing all orders and metrics due to status update');
        loadOrdersWrapper();
        loadMetricsWrapper();
      }
    };

    // Access the socket from the global io object
    const socket = (window as any).io;
    if (socket) {
      // Only add listener if socket exists
      if (socket.connected) {
        socket.on('order-status-updated', handleOrderStatusUpdate);
      }

      // Always cleanup the listener, regardless of connection status
      return () => {
        if (socket) {
          socket.off('order-status-updated', handleOrderStatusUpdate);
        }
      };
    }
  }, [isConnected, setOrders, setTotalRevenue, setPendingOrders, loadMetricsWrapper, loadOrdersWrapper]);
}


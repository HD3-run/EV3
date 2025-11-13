// Metrics query functions for orders

import { getApiUrl } from '../../../config/api';

/**
 * Load metrics from server (total orders, revenue, pending, today orders)
 */
export const loadMetrics = async (): Promise<{
  totalRevenue: number;
  pendingOrders: number;
  todayOrders: number;
}> => {
  try {
    console.log('🔄 Loading metrics from server...');
    
    // Load all orders for metrics calculation (without pagination)
    const response = await fetch(getApiUrl('/api/orders?limit=50000&page=1'), {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.orders && Array.isArray(data.orders)) {
        const allOrders = data.orders.map((order: any) => ({
          id: order.order_id.toString(),
          orderId: `ORD${order.order_id}`,
          customerId: `CUS${order.customer_id}`,
          customerName: order.customer_name || 'Unknown',
          amount: parseFloat(order.display_amount) || 0,
          status: order.status || 'pending',
          date: new Date(order.order_date || order.created_at).toISOString().split('T')[0],
          channel: order.order_source || 'Unknown',
          type: 'Standard',
          customer: order.customer_name || 'Unknown',
          paymentStatus: order.payment_status || 'pending',
          user_id: order.user_id,
          order_items: order.order_items || []
        }));

        // Calculate metrics from all orders
        const totalRev = allOrders.reduce((sum: number, order: any) => {
          return order.paymentStatus === 'paid' ? sum + (order.amount || 0) : sum;
        }, 0);
        
        const pendingCount = allOrders.filter((order: any) => order.paymentStatus === 'pending').length;
        
        const today = new Date().toISOString().split('T')[0];
        const todayCount = allOrders.filter((order: any) => order.date === today).length;
        
        console.log('💰 Total Revenue calculated:', totalRev, '(paid orders only)');
        console.log('⏳ Pending Orders calculated (paymentStatus = pending):', pendingCount);
        console.log('📅 Today Orders calculated:', todayCount);
        console.log('📊 Total orders processed for metrics:', allOrders.length);
        
        return {
          totalRevenue: totalRev,
          pendingOrders: pendingCount,
          todayOrders: todayCount
        };
      } else {
        console.warn('⚠️ No orders data received from server');
        return { totalRevenue: 0, pendingOrders: 0, todayOrders: 0 };
      }
    } else {
      console.error('❌ Failed to load metrics from server:', response.status, response.statusText);
      return { totalRevenue: 0, pendingOrders: 0, todayOrders: 0 };
    }
  } catch (error) {
    console.error('💥 Error loading metrics:', error);
    return { totalRevenue: 0, pendingOrders: 0, todayOrders: 0 };
  }
};


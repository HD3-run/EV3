// Metrics query functions for orders

import { getApiUrl } from '../../../config/api';

/**
 * Load metrics from server (total orders, revenue, pending, today orders)
 * Now uses dedicated metrics endpoint for efficient server-side calculation
 */
export const loadMetrics = async (): Promise<{
  totalRevenue: number;
  pendingOrders: number;
  todayOrders: number;
}> => {
  try {
    console.log('🔄 Loading metrics from server...');

    // Use dedicated metrics endpoint for efficient server-side calculation
    const response = await fetch(getApiUrl('/api/orders/metrics'), {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (response.ok) {
      const metrics = await response.json();

      console.log('💰 Total Revenue:', metrics.totalRevenue, '(from server)');
      console.log('⏳ Pending Orders:', metrics.pendingOrders, '(from server)');
      console.log('📅 Today Orders:', metrics.todayOrders, '(from server)');
      console.log('✅ Metrics loaded via server-side calculation');

      return {
        totalRevenue: metrics.totalRevenue || 0,
        pendingOrders: metrics.pendingOrders || 0,
        todayOrders: metrics.todayOrders || 0
      };
    } else {
      console.error('❌ Failed to load metrics from server:', response.status, response.statusText);
      return { totalRevenue: 0, pendingOrders: 0, todayOrders: 0 };
    }
  } catch (error) {
    console.error('💥 Error loading metrics:', error);
    return { totalRevenue: 0, pendingOrders: 0, todayOrders: 0 };
  }
};

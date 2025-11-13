// API query functions for orders

import { getApiUrl } from '../../../config/api';
import type { Order } from '../types/order.types';

/**
 * Load orders with pagination, filtering, and sorting
 */
export const loadOrders = async (
  page: number = 1,
  searchTerm: string = '',
  filterType: string = 'all',
  date?: string
): Promise<{ orders: Order[]; total: number }> => {
  try {
    // Build query parameters for server-side filtering and pagination
    const params = new URLSearchParams({
      limit: '50',
      page: page.toString()
    });
    
    if (searchTerm) {
      params.append('search', searchTerm);
    }
    
    if (filterType && filterType !== 'all') {
      params.append('status', filterType);
    }
    
    // Handle date filtering from URL parameters or passed parameter
    const currentDateParam = date || new URLSearchParams(window.location.search).get('date');
    if (currentDateParam) {
      params.append('date', currentDateParam);
      console.log('🔍 Loading orders with date filter:', currentDateParam);
    }
    
    // Load orders with server-side pagination and filtering
    // Add cache-busting parameter to avoid stale cached data
    params.append('_t', Date.now().toString());
    const response = await fetch(`/api/orders?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-cache' // Explicitly disable cache
    });

    if (response.ok) {
      const data = await response.json();

      // Debug logging for assigned filter
      if (filterType === 'assigned') {
        console.log('🔍 Assigned filter - API response:', {
          ordersCount: data.orders?.length || 0,
          total: data.pagination?.total || 0,
          page: data.pagination?.page || 1,
          limit: data.pagination?.limit || 50,
          totalPages: data.pagination?.totalPages || 0
        });
      }

      if (data.orders && Array.isArray(data.orders)) {
        const formattedOrders: Order[] = data.orders.map((order: any) => {
          // Debug log for cancelled orders
          if (order.order_id === 18437 || order.order_id === 18439) {
            console.log('🔍 DEBUG: Order', order.order_id, 'from API:', {
              order_id: order.order_id,
              status: order.status,
              payment_status: order.payment_status
            });
          }
          
          return {
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
            assigned_user_name: order.assigned_user_name,
            assigned_user_role: order.assigned_user_role,
            order_items: order.order_items || []
          };
        });

        // Debug logging for assigned filter
        if (filterType === 'assigned') {
          console.log('✅ Assigned filter - Formatted orders:', {
            formattedCount: formattedOrders.length,
            apiOrdersCount: data.orders?.length || 0,
            total: data.pagination?.total || 0,
            page: data.pagination?.page || 1,
            limit: data.pagination?.limit || 50
          });
          if (formattedOrders.length !== (data.orders?.length || 0)) {
            console.warn('⚠️ WARNING: Formatted orders count differs from API orders count!');
          }
        }

        return {
          orders: formattedOrders,
          total: data.pagination?.total || 0
        };
      } else {
        return { orders: [], total: 0 };
      }
    } else {
      await response.text();
      return { orders: [], total: 0 };
    }
  } catch (error) {
    console.error('Error loading orders:', error);
    return { orders: [], total: 0 };
  }
};

/**
 * Load total orders count
 */
export const loadTotalOrders = async (): Promise<number> => {
  try {
    const response = await fetch(getApiUrl('/api/orders?limit=50&page=1'), {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      if (data.pagination && data.pagination.total) {
        return data.pagination.total;
      }
    }
    return 0;
  } catch (error) {
    console.error('Failed to load total orders count');
    return 0;
  }
};


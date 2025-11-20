// Custom hook for order filtering and sorting

import { useMemo } from 'react';
import type { Order } from '../types/order.types';

export function useOrderFilters(
  orders: Order[],
  appliedSearchTerm: string,
  filterType: string,
  sortKey: keyof Order,
  sortOrder: 'asc' | 'desc'
) {
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    // Apply search filter
    if (appliedSearchTerm) {
      const searchLower = appliedSearchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.customerName?.toLowerCase().includes(searchLower) ||
        order.customerId?.toString().includes(searchLower) ||
        order.orderId?.toString().includes(searchLower)
      );
    }

    // Apply status filter
    // Special handling for "assigned" filter - check user_id instead of status
    // because assignment doesn't change status anymore
    if (filterType !== 'all') {
      if (filterType === 'assigned') {
        filtered = filtered.filter(order => order.user_id != null);
      } else {
        filtered = filtered.filter(order => order.status === filterType);
      }
    }

    // Sort orders
    filtered.sort((a, b) => {
      // Special handling for payment status sorting
      if (sortKey === 'paymentStatus') {
        const aStatus = a.paymentStatus || 'pending';
        const bStatus = b.paymentStatus || 'pending';
        
        // Define priority: 'paid' = 1, 'pending' = 2, others = 3
        const getPriority = (status: string) => {
          if (status === 'paid') return 1;
          if (status === 'pending') return 2;
          return 3;
        };
        
        const aPriority = getPriority(aStatus);
        const bPriority = getPriority(bStatus);
        
        if (sortOrder === 'asc') {
          // Ascending: paid first, then pending, then others
          return aPriority - bPriority;
        } else {
          // Descending: others first, then pending, then paid
          return bPriority - aPriority;
        }
      }
      
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

    return filtered;
  }, [orders, appliedSearchTerm, filterType, sortKey, sortOrder]);

  return filteredAndSortedOrders;
}


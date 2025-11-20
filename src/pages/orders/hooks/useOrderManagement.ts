// Custom hook for order management state and effects

import { useState, useEffect, useRef } from 'react';
import { loadOrders, loadTotalOrders } from '../queries/orderQueries';
import { loadMetrics } from '../queries/metricsQueries';
import { loadEmployees } from '../queries/employeeQueries';
import { loadProducts } from '../queries/productQueries';
import type { Order } from '../types/order.types';

export function useOrderManagement(userRole: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'assigned' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned'>('all');
  const [sortKey, setSortKey] = useState<keyof Order>('orderId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState<any[]>([]);

  // Load metrics wrapper
  const loadMetricsWrapper = async () => {
    const metrics = await loadMetrics();
    setTotalRevenue(metrics.totalRevenue);
    setPendingOrders(metrics.pendingOrders);
    setTodayOrders(metrics.todayOrders);
  };

  // Load total orders wrapper
  const loadTotalOrdersWrapper = async () => {
    const total = await loadTotalOrders();
    setTotalOrders(total);
  };

  // Wrapper for loadOrders
  const loadOrdersWrapper = async (page: number = currentPage, date?: string) => {
    setLoading(true);
    try {
      const result = await loadOrders(page, appliedSearchTerm, filterType, date);
      setOrders(result.orders);
      setTotalOrders(result.total);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search term - automatically search after user stops typing for 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (appliedSearchTerm !== searchTerm) {
        setAppliedSearchTerm(searchTerm);
        setCurrentPage(1);
        // Maintain focus on input field
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [searchTerm, appliedSearchTerm]);

  // Reset to first page when filters change and reload data
  useEffect(() => {
    setCurrentPage(1);
    // Check if we have a date parameter in the URL and preserve it
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    loadOrdersWrapper(1, dateParam || undefined); // Reload first page when filters change
  }, [appliedSearchTerm, filterType]);

  // Load initial data
  useEffect(() => {
    // Handle URL parameters on component mount
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    const dateParam = urlParams.get('date');
    
    if (statusParam && ['pending', 'assigned', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'].includes(statusParam)) {
      setFilterType(statusParam as any);
    }
    
    // Load employees and products
    loadEmployees(userRole).then((employees) => setEmployees(employees as any));
    loadProducts().then((products) => setProducts(products));
    // Pass the date parameter directly to loadOrders to ensure it's used
    loadOrdersWrapper(1, dateParam || undefined);
    loadTotalOrdersWrapper();
  }, [userRole]);

  // Load metrics on component mount
  useEffect(() => {
    loadMetricsWrapper();
  }, []);

  // Refresh metrics when component regains focus (in case user switched tabs)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Component regained focus - refreshing metrics');
      loadMetricsWrapper();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    loadOrdersWrapper(newPage, dateParam || undefined);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Immediately apply search on Enter
      setAppliedSearchTerm(searchTerm);
      setCurrentPage(1);
      const urlParams = new URLSearchParams(window.location.search);
      const dateParam = urlParams.get('date');
      loadOrdersWrapper(1, dateParam || undefined);
    }
  };

  return {
    // State
    orders,
    setOrders,
    loading,
    totalOrders,
    setTotalOrders,
    totalRevenue,
    setTotalRevenue,
    pendingOrders,
    setPendingOrders,
    todayOrders,
    setTodayOrders,
    filterType,
    setFilterType,
    sortKey,
    setSortKey,
    sortOrder,
    setSortOrder,
    searchTerm,
    setSearchTerm,
    appliedSearchTerm,
    setAppliedSearchTerm,
    searchInputRef,
    currentPage,
    setCurrentPage,
    employees,
    setEmployees,
    products,
    setProducts,
    // Functions
    loadOrdersWrapper,
    loadTotalOrdersWrapper,
    loadMetricsWrapper,
    handlePageChange,
    handleSearchKeyDown
  };
}


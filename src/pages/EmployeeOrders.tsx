import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';

interface OrderItem {
  order_item_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  sku: string;
}

interface CustomerDetails {
  name?: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  delivery_note?: string;
}

interface Order {
  id: string;
  orderId: string;
  customerName: string;
  customerId?: string;
  channel: string;
  type: string;
  customer: string;
  status: string;
  amount: number;
  date: string;
  paymentStatus?: string;
  order_items?: OrderItem[];
  customerDetails?: CustomerDetails;
}

export default function EmployeeOrders() {
  const { user } = useAuth();
  const userRole = user?.role || '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const itemsPerPage = 50; // 50 items per page like admin orders
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Get allowed status options based on role and current status
  const getAllowedStatusOptions = (currentStatus: string): string[] => {
    // NO USER can change status to 'pending'
    
    // Delivery role - can ONLY change shipped → delivered
    // Can also change from assigned → delivered directly
    // NO cancelled option for Delivery role
    if (userRole === 'Delivery') {
      if (currentStatus === 'shipped') {
        return ['delivered'];
      }
      if (currentStatus === 'assigned') {
        return ['delivered'];
      }
      return []; // No other transitions allowed
    }
    
    // Shipment role - can ONLY change confirmed → shipped
    // Can also change from assigned → shipped directly
    // NO cancelled option for Shipment role
    // Shipment should ONLY see 'shipped' status option
    if (userRole === 'Shipment') {
      if (currentStatus === 'confirmed') {
        return ['shipped'];
      }
      if (currentStatus === 'assigned') {
        return ['shipped'];
      }
      return []; // No other transitions allowed
    }
    
    // Employee role - can change to forward statuses (no cancelled, no returned)
    // Cannot change from returned or cancelled orders (final states)
    if (userRole === 'Employee') {
      // Returned and cancelled are final states - no status changes allowed
      if (currentStatus === 'returned' || currentStatus === 'cancelled') {
        return [];
      }
      
      if (currentStatus === 'pending') {
        return ['confirmed'];
      }
      if (currentStatus === 'confirmed') {
        return ['shipped'];
      }
      if (currentStatus === 'shipped') {
        return ['delivered'];
      }
      if (currentStatus === 'assigned') {
        return ['confirmed', 'shipped', 'delivered'];
      }
      return [];
    }
    
    // Default: no status changes allowed
    return [];
  };


  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    loadOrders(1);
  }, [searchTerm, filterType]);

  const loadOrders = async (page: number = currentPage) => {
    try {
      setError(null);
      console.log('Loading orders for employee orders page');
      
      // Build query parameters for server-side filtering and pagination
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        page: page.toString()
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      if (filterType && filterType !== 'all') {
        params.append('status', filterType);
      }
      
      const response = await fetch(getApiUrl(`/api/orders?${params.toString()}`), {
        credentials: 'include'
      });
      
      console.log('Employee orders API response:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error in EmployeeOrders:', response.status, errorData);
        setError(`Failed to load orders: ${response.status} - ${errorData}`);
        setOrders([]);
        return;
      }
      
      const data = await response.json();
      console.log('Employee orders data:', data);
      
      if (data.orders && Array.isArray(data.orders)) {
        const formattedOrders = data.orders.map((order: any) => ({
          id: order.order_id.toString(),
          orderId: `ORD${order.order_id}`,
          customerName: order.customer_name || 'Unknown',
          customerId: order.customer_id?.toString(),
          amount: parseFloat(order.total_amount) || 0,
          status: order.status || 'pending',
          date: new Date(order.order_date || order.created_at).toISOString().split('T')[0],
          channel: order.order_source || 'Unknown',
          type: 'Standard',
          customer: order.customer_name || 'Unknown',
          paymentStatus: order.payment_status || 'pending',
          order_items: order.order_items || [],
          customerDetails: order.customer_details || undefined
        }));
        setOrders(formattedOrders);
        
        // Update total count from pagination data
        if (data.pagination && data.pagination.total) {
          setTotalOrders(data.pagination.total);
        }
        
        console.log('Formatted orders for employee:', formattedOrders.length);
      } else {
        console.warn('No orders array in employee orders response:', data);
        setOrders([]);
        if (data.debug) {
          console.log('Debug info from employee orders API:', data.debug);
        }
      }
    } catch (error) {
      console.error('Failed to load employee orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/employee/orders/${orderId}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );
      } else {
        const errorData = await response.json();
        alert(errorData.message);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Network error occurred');
    }
  };

  const toggleOrderExpansion = async (orderId: string) => {
    const isExpanded = expandedOrders.has(orderId);
    
    if (isExpanded) {
      // Collapse
      setExpandedOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    } else {
      // Expand - fetch order details if not already loaded
      const order = orders.find(o => o.id === orderId);
      if (order && (!order.order_items || order.order_items.length === 0 || !order.customerDetails)) {
        // Fetch order details
        setLoadingDetails(prev => new Set(prev).add(orderId));
        try {
          // Fetch order details
          const orderResponse = await fetch(getApiUrl(`/api/orders/${orderId}`), {
            credentials: 'include'
          });
          
          let orderData = null;
          if (orderResponse.ok) {
            const data = await orderResponse.json();
            orderData = data.order;
          }
          
          // Fetch customer details if customerId is available
          let customerDetails = null;
          if (order.customerId || (orderData && orderData.customer_id)) {
            // Extract numeric ID from "CUS123" format or use numeric ID directly
            let customerId = order.customerId || orderData?.customer_id?.toString();
            if (customerId && customerId.startsWith('CUS')) {
              customerId = customerId.replace('CUS', '');
            }
            
            if (customerId) {
              try {
                const customerResponse = await fetch(getApiUrl(`/api/customers/${customerId}`), {
                  credentials: 'include'
                });
                
                if (customerResponse.ok) {
                  customerDetails = await customerResponse.json();
                }
              } catch (customerError) {
                console.error('Error fetching customer details:', customerError);
              }
            }
          }
          
          // Update order with fetched data
          setOrders(prevOrders =>
            prevOrders.map(o =>
              o.id === orderId
                ? {
                    ...o,
                    order_items: orderData?.order_items || o.order_items || [],
                    paymentStatus: orderData?.payment_status || o.paymentStatus,
                    customerDetails: customerDetails || o.customerDetails,
                    customerId: orderData?.customer_id?.toString() || o.customerId
                  }
                : o
            )
          );
        } catch (error) {
          console.error('Error fetching order details:', error);
        } finally {
          setLoadingDetails(prev => {
            const newSet = new Set(prev);
            newSet.delete(orderId);
            return newSet;
          });
        }
      }
      
      // Expand the order
      setExpandedOrders(prev => new Set(prev).add(orderId));
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.orderId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || order.status === filterType;

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">My Orders</h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-gray-600 dark:text-gray-400">Loading your orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">My Orders</h1>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex justify-between items-center">
            <div>
              <strong className="font-bold">Error Loading Orders:</strong>
              <span className="block sm:inline ml-2">{error}</span>
            </div>
            <button 
              onClick={() => { setError(null); loadOrders(); }}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4">
        <input
          type="text"
          placeholder="Search by customer or order ID..."
          className="p-2 border border-gray-300 dark:border-gray-700 rounded-md w-full sm:w-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Channel</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="text-gray-500 dark:text-gray-400">
                    <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="text-lg font-medium mb-2">
                      {searchTerm || filterType !== 'all' ? 'No Matching Orders' : 'No Orders Assigned'}
                    </h3>
                    <p className="text-sm mb-4">
                      {searchTerm || filterType !== 'all' 
                        ? 'Try adjusting your search or filter criteria.' 
                        : (error 
                          ? 'There was an error loading your orders.' 
                          : 'No orders have been assigned to you yet. Contact your admin to assign orders.'
                        )
                      }
                    </p>
                    {(!searchTerm && filterType === 'all') && (
                      <button 
                        onClick={() => loadOrders()}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
                      >
                        Refresh Orders
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <>
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{order.orderId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.customerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.channel}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'returned' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${order.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => toggleOrderExpansion(order.id)}
                          className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          {expandedOrders.has(order.id) ? 'Hide' : 'Details'}
                        </button>
                        {(() => {
                          const allowedStatuses = getAllowedStatusOptions(order.status);
                          const canChangeStatus = allowedStatuses.length > 0 && order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'returned';
                          
                          if (!canChangeStatus) {
                            return (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {order.status === 'delivered' || order.status === 'cancelled' ? 'Final status' : 
                                 order.status === 'returned' ? 'Admin only' : 
                                 'No changes allowed'}
                              </span>
                            );
                          }
                          
                          return (
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value={order.status}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</option>
                              {allowedStatuses.map(status => (
                                <option key={status} value={status}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                  {expandedOrders.has(order.id) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                        {loadingDetails.has(order.id) ? (
                          <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Loading order details...</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Order Date</p>
                              <p className="text-sm text-gray-900 dark:text-white">{order.date}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Order Source</p>
                              <p className="text-sm text-gray-900 dark:text-white">{order.channel || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payment Status</p>
                              <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${
                                order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                order.paymentStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                order.paymentStatus === 'refunded' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}>
                                {order.paymentStatus || 'pending'}
                              </span>
                            </div>
                            
                            {/* Customer Details Box */}
                            {order.customerDetails && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Customer Details</p>
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2">
                                  {order.customerDetails.name && (
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Name</p>
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">{order.customerDetails.name}</p>
                                    </div>
                                  )}
                                  {order.customerDetails.phone && (
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Phone</p>
                                      <p className="text-sm text-gray-900 dark:text-white">{order.customerDetails.phone}</p>
                                    </div>
                                  )}
                                  {order.customerDetails.email && (
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Email</p>
                                      <p className="text-sm text-gray-900 dark:text-white">{order.customerDetails.email}</p>
                                    </div>
                                  )}
                                  {(order.customerDetails.address_line1 || order.customerDetails.city || order.customerDetails.pincode) && (
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Address</p>
                                      <p className="text-sm text-gray-900 dark:text-white">
                                        {[
                                          order.customerDetails.address_line1,
                                          order.customerDetails.address_line2,
                                          order.customerDetails.landmark,
                                          order.customerDetails.city,
                                          order.customerDetails.state,
                                          order.customerDetails.pincode
                                        ].filter(Boolean).join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Delivery Note Box */}
                            {order.customerDetails?.delivery_note && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Delivery Note</p>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                                    {order.customerDetails.delivery_note}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
                                  Products Ordered
                                </p>
                                <div className="space-y-2">
                                  {order.order_items && order.order_items.length > 0 ? (
                                    order.order_items.map((item, idx) => (
                                      <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                        <div className="space-y-2 text-sm">
                                          <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Product</p>
                                            <p className="font-medium text-gray-900 dark:text-white">{item.product_name || 'Unknown Product'}</p>
                                          </div>
                                          <div className="flex gap-4">
                                            <div>
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">SKU</p>
                                              <p className="font-mono text-sm text-gray-900 dark:text-white">{item.sku || 'N/A'}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Quantity × Price</p>
                                              <p className="text-sm text-gray-900 dark:text-white">
                                                {item.quantity} × {formatCurrency(item.price_per_unit)} = <span className="font-semibold">{formatCurrency(item.total_price)}</span>
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No products found</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {Math.ceil(totalOrders / itemsPerPage) > 1 && (() => {
        const totalPages = Math.ceil(totalOrders / itemsPerPage);
        const handlePrevious = () => {
          if (currentPage === 1) {
            // Wrap around to last page when on first page
            const newPage = totalPages;
            setCurrentPage(newPage);
            loadOrders(newPage);
          } else {
            const newPage = currentPage - 1;
            setCurrentPage(newPage);
            loadOrders(newPage);
          }
        };
        const handleNext = () => {
          if (currentPage >= totalPages) {
            // Wrap around to first page when on last page
            const newPage = 1;
            setCurrentPage(newPage);
            loadOrders(newPage);
          } else {
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            loadOrders(newPage);
          }
        };
        return (
          <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalOrders)} of {totalOrders} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevious}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of <button
                  onClick={() => {
                    setCurrentPage(totalPages);
                    loadOrders(totalPages);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium cursor-pointer"
                  title="Go to last page"
                >
                  {totalPages}
                </button>
              </span>
              <button
                onClick={handleNext}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
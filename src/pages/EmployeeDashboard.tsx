import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

interface AssignedOrder {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  total_amount: number;
  status: string;
  assigned_at: string;
  delivery_notes?: string;
}

 

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [assignedOrders, setAssignedOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug] = useState(process.env.NODE_ENV === 'development');
  const [stats, setStats] = useState({
    totalAssigned: 0,
    completed: 0,
    pending: 0,
    inProgress: 0
  });

  useEffect(() => {
    loadAssignedOrders();
    if (showDebug) {
      loadDebugInfo();
    }
  }, []);

  const loadDebugInfo = async () => {
    try {
      const response = await fetch(getApiUrl('/api/orders/debug'), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data);
      }
    } catch (error) {
      console.error('Debug info load failed:', error);
    }
  };

  const loadAssignedOrders = async () => {
    try {
      setError(null);
      console.log('Loading assigned orders for employee dashboard');
      
      // Use cache-busting parameter to avoid stale cached data
      const cacheBuster = `?limit=50000&page=1&_t=${Date.now()}`;
      const response = await fetch(getApiUrl(`/api/orders${cacheBuster}`), {
        credentials: 'include',
        cache: 'no-cache' // Explicitly disable cache
      });
      
      console.log('Employee dashboard API response:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        setError(`API Error: ${response.status} - ${errorData}`);
        throw new Error(`API Error: ${response.status} - ${errorData}`);
      }
      
      const data = await response.json();
      console.log('Employee dashboard data:', data);
      
      if (data.orders && Array.isArray(data.orders)) {
        const formattedOrders = data.orders.map((order: any) => ({
          order_id: order.order_id.toString(),
          order_number: `ORD${order.order_id}`,
          customer_name: order.customer_name || 'Unknown',
          customer_phone: order.customer_phone || 'N/A',
          delivery_address: order.customer_address || order.customer_email || 'N/A',
          total_amount: parseFloat(order.total_amount) || 0,
          status: order.status || 'pending',
          assigned_at: order.created_at || new Date().toISOString()
        }));
        setAssignedOrders(formattedOrders);
        calculateStats(formattedOrders);
      } else {
        console.warn('No orders array in response:', data);
        setAssignedOrders([]);
        calculateStats([]);
        if (data.debug) {
          console.log('Debug info from API:', data.debug);
        }
      }
    } catch (error) {
      console.error('Failed to load assigned orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to load orders');
      setAssignedOrders([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (orders: AssignedOrder[]) => {
    const stats = {
      totalAssigned: orders.length,
      completed: orders.filter(o => o.status === 'delivered').length,
      pending: orders.filter(o => o.status === 'pending').length,
      inProgress: orders.filter(o => o.status === 'shipped').length
    };
    setStats(stats);
  };

  // Get allowed status options based on user role and current status
  const getAllowedStatusOptions = (currentStatus: string, userRole: string) => {
    const allStatuses = [
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'shipped', label: 'Shipped' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'returned', label: 'Returned' }
    ];

    // 'delivered' is final status for all roles - cannot change from delivered
    if (currentStatus === 'delivered') {
      return [];
    }

    // NO USER can change status to 'pending' - remove it from all options
    const statusesWithoutPending = allStatuses.filter(status => status.value !== 'pending');

    // Delivery role permissions - can ONLY change shipped → delivered
    // Can also change from assigned → delivered directly
    // NO cancelled option for Delivery role
    // Delivery should ONLY see 'delivered' status option
    if (userRole === 'Delivery') {
      if (currentStatus === 'shipped') {
        // Only show 'delivered' - no cancelled
        return statusesWithoutPending.filter(status => status.value === 'delivered');
      }
      if (currentStatus === 'assigned') {
        // Can change from assigned to delivered directly
        return statusesWithoutPending.filter(status => status.value === 'delivered');
      }
      return []; // No other transitions allowed
    }

    // Shipment role permissions - can ONLY change confirmed → shipped (shipped is final for them)
    // Can also change from assigned → confirmed → shipped
    // NO cancelled option for Shipment role
    // Shipment should ONLY see 'shipped' status option
    if (userRole === 'Shipment') {
      if (currentStatus === 'confirmed') {
        // Only show 'shipped' - nothing else
        return statusesWithoutPending.filter(status => status.value === 'shipped');
      }
      if (currentStatus === 'assigned') {
        // Can change from assigned to confirmed, then to shipped
        // But user wants Shipment to only see 'shipped', so skip 'confirmed' step
        // Actually, let's allow assigned → shipped directly for Shipment
        return statusesWithoutPending.filter(status => status.value === 'shipped');
      }
      // Cannot change from shipped (it's their final state) or any other status
      return [];
    }

    // Employee role permissions - can only move forward in status flow, not backwards
    // Status flow: pending → confirmed → shipped → delivered
    // Cannot go backwards (e.g., shipped → confirmed) or to returned/cancelled/pending
    // From "assigned" status, can move to any forward status
    // Cannot change from returned or cancelled orders (final states)
    if (userRole === 'Employee') {
      // Returned and cancelled are final states - no status changes allowed
      if (currentStatus === 'returned' || currentStatus === 'cancelled') {
        return [];
      }
      
      const statusOrder = ['pending', 'confirmed', 'shipped', 'delivered'];
      const currentIndex = statusOrder.indexOf(currentStatus);
      
      return statusesWithoutPending.filter(status => {
        // Don't allow current status
        if (status.value === currentStatus) return false;
        // Don't allow returned or cancelled
        if (status.value === 'returned' || status.value === 'cancelled') return false;
        // If current status is "assigned", allow all forward statuses
        if (currentStatus === 'assigned') {
          return true; // Can go from assigned to any forward status
        }
        // Don't allow backwards transitions
        const targetIndex = statusOrder.indexOf(status.value);
        if (currentIndex !== -1 && targetIndex !== -1 && targetIndex < currentIndex) {
          return false; // Backwards transition not allowed
        }
        return true;
      });
    }

    // Admin role - can change any status (not restricted here, handled by backend) but not to pending
    if (userRole === 'admin') {
      // Admin can change from any status to any other status except pending
      return statusesWithoutPending.filter(status => status.value !== currentStatus);
    }

    // For any other role (should not happen with proper validation)
    return [];
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    // Find the current order to check its status
    const currentOrder = assignedOrders.find(order => order.order_id === orderId);
    
    // Prevent API call if status hasn't actually changed
    if (currentOrder && currentOrder.status === newStatus) {
      console.log('Status unchanged, skipping API call');
      return;
    }
    
    try {
      const response = await fetch(`/api/employee/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        // Update local state immediately for better UX - do both updates in one call
        setAssignedOrders(prevOrders => {
          const updatedOrders = prevOrders.map(order => {
            // Ensure we're comparing strings
            const orderIdStr = String(order.order_id);
            const targetIdStr = String(orderId);
            if (orderIdStr === targetIdStr) {
              console.log('Updating order status in state:', orderIdStr, 'from', order.status, 'to', newStatus);
              return { ...order, status: newStatus };
            }
            return order;
          });
          
          // Verify the update happened
          const updatedOrder = updatedOrders.find(order => String(order.order_id) === String(orderId));
          if (updatedOrder && updatedOrder.status === newStatus) {
            console.log('State update successful:', updatedOrder.order_id, 'now has status', updatedOrder.status);
          } else {
            console.warn('State update may have failed - order not found or status mismatch');
          }
          
          // Recalculate stats with updated orders
          calculateStats(updatedOrders);
          return updatedOrders;
        });
        // Don't reload immediately - the state update is correct and reloading might get stale cached data
        // Only reload if there's a mismatch (which we'll check after a delay)
        setTimeout(() => {
          // Check if our state update is still correct by verifying with backend
          // But use a cache-busting parameter to avoid stale data
          const cacheBuster = `?limit=50000&page=1&_t=${Date.now()}`;
          fetch(getApiUrl(`/api/orders${cacheBuster}`), {
            credentials: 'include'
          })
            .then(res => res.json())
            .then(data => {
              if (data.orders) {
                const backendOrder = data.orders.find((o: any) => String(o.order_id) === String(orderId));
                if (backendOrder && backendOrder.status !== newStatus) {
                  console.warn('State mismatch detected, reloading from backend');
                  loadAssignedOrders();
                } else {
                  console.log('State matches backend, no reload needed');
                }
              }
            })
            .catch(err => {
              console.error('Error verifying state with backend:', err);
              // On error, don't reload - trust our state update
            });
        }, 1000);
      } else {
        const errorData = await response.json();
        alert(`Failed to update order status: ${errorData.message || 'Unknown error'}`);
        // Reload on error to sync with backend state
        loadAssignedOrders();
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
      // Reload on error to sync with backend state
      loadAssignedOrders();
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your assigned orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Debug Panel for Development */}
      {showDebug && debugInfo && (
        <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Debug Information</h3>
            <button 
              onClick={loadDebugInfo}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Refresh Debug Info
            </button>
          </div>
          <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex justify-between items-center">
            <div>
              <strong className="font-bold">Error Loading Orders:</strong>
              <span className="block sm:inline ml-2">{error}</span>
            </div>
            <button 
              onClick={() => { setError(null); loadAssignedOrders(); }}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Welcome, {user?.username}</h1>
        <p className="text-gray-600 dark:text-gray-400">Role: {user?.role}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Total Assigned</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalAssigned}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Pending</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">In Progress</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
        </div>
      </div>

      {/* Current Orders */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Current Assigned Orders</h2>
        </div>
        
        {assignedOrders.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium mb-2">No Orders Assigned</h3>
              <p className="text-sm mb-4">
                {error ? 'There was an error loading your orders.' : 'No orders have been assigned to you yet.'}
              </p>
              <button 
                onClick={loadAssignedOrders}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
              >
                Refresh Orders
              </button>
            </div>
            
            {/* Additional debug info for development */}
            {showDebug && (
              <div className="mt-4 text-left bg-gray-100 dark:bg-gray-800 p-4 rounded">
                <h4 className="font-bold mb-2">Troubleshooting:</h4>
                <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• Check if you are logged in as the correct user</li>
                  <li>• Verify that orders have been assigned to your account</li>
                  <li>• Contact your administrator if the problem persists</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {assignedOrders.map((order) => (
                  <tr key={order.order_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {order.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {order.customer_phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">
                      {order.delivery_address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      ₹{order.total_amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {getAllowedStatusOptions(order.status, user?.role || '').length > 0 ? (
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.order_id, e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                          <option value={order.status} disabled>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)} (Current)
                          </option>
                        {getAllowedStatusOptions(order.status, user?.role || '').map(status => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      ) : (
                        <span className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400">
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
// Order card component

import { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../../../utils/currency';
import type { Order } from '../types/order.types';

interface OrderCardProps {
  order: Order;
  expandedOrders: Set<string>;
  onToggleExpansion: (orderId: string) => void;
  onViewCustomerDetails: (customerId: string) => void;
  onPaymentClick: (order: Order, status: string) => void;
  onReturnOrder: (order: Order) => void;
  onAssignClick: (order: Order) => void;
  onStatusUpdate: (orderId: string, newStatus: string) => void;
  updatingOrderId: number | null;
  userRole: string;
}

export default function OrderCard({
  order,
  expandedOrders,
  onToggleExpansion,
  onViewCustomerDetails,
  onPaymentClick,
  onReturnOrder,
  onAssignClick,
  onStatusUpdate,
  updatingOrderId,
  userRole
}: OrderCardProps) {
  const isExpanded = expandedOrders.has(order.id);
  const isUpdating = updatingOrderId === parseInt(order.id, 10);

  // Get allowed status options based on role and current status
  const getAllowedStatusOptions = (): string[] => {
    const currentStatus = order.status;
    
    // NO USER can change status to 'pending' - remove it from all options
    
    // Admin can change to any status except pending
    if (userRole === 'admin') {
      // Cannot change from delivered (final state)
      if (currentStatus === 'delivered') {
        return [];
      }
      return ['confirmed', 'shipped', 'delivered', 'cancelled', 'returned'];
    }
    
    // Employee: can change to any status except returned, cancelled, and pending
    // Can change from assigned to any status except returned, cancelled, and pending
    if (userRole === 'Employee') {
      // Cannot change from delivered (final state)
      if (currentStatus === 'delivered') {
        return [];
      }
      return ['confirmed', 'shipped', 'delivered'];
    }
    
    // Delivery: can ONLY change shipped → delivered
    // Can also change from assigned → shipped → delivered
    // NO cancelled option for Delivery role
    // Delivery should ONLY see 'delivered' status option
    if (userRole === 'Delivery') {
      if (currentStatus === 'shipped') {
        // Only show 'delivered' - no cancelled
        return ['delivered'];
      }
      if (currentStatus === 'assigned') {
        // Can change from assigned to shipped, then to delivered
        // But user wants Delivery to only see 'delivered', so skip 'shipped' step
        // Actually, let's allow assigned → delivered directly for Delivery
        return ['delivered'];
      }
      // Cannot change from delivered or any other status
      return [];
    }
    
    // Shipment: can ONLY change confirmed → shipped (shipped is final for them)
    // Can also change from assigned → confirmed → shipped
    // NO cancelled option for Shipment role
    // Shipment should ONLY see 'shipped' status option
    if (userRole === 'Shipment') {
      if (currentStatus === 'confirmed') {
        // Only show 'shipped' - nothing else
        return ['shipped'];
      }
      if (currentStatus === 'assigned') {
        // Can change from assigned to confirmed, then to shipped
        // But user wants Shipment to only see 'shipped', so skip 'confirmed' step
        // Actually, let's allow assigned → shipped directly for Shipment
        return ['shipped'];
      }
      // Cannot change from shipped (final for them) or any other status
      return [];
    }
    
    // Default: no status changes allowed
    return [];
  };

  const allowedStatuses = getAllowedStatusOptions();
  const canChangeStatus = allowedStatuses.length > 0 && order.status !== 'delivered' && order.status !== 'cancelled' && order.status !== 'returned';
  // Show assigned badge if order has a user_id (assigned to someone)
  const isAssigned = !!order.user_id && userRole === 'admin';
  const [showAssignedTooltip, setShowAssignedTooltip] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState<Array<{
    user_id: number;
    username: string;
    role: string;
    assigned_at: string | null;
    is_current: boolean;
  }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Fetch assignment history when tooltip opens
  useEffect(() => {
    const fetchAssignmentHistory = async () => {
      if (showAssignedTooltip && userRole === 'admin' && order.id) {
        setLoadingHistory(true);
        try {
          const response = await fetch(`/api/orders/${order.id}/assignment-history`, {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            setAssignmentHistory(data.assignments || []);
          }
        } catch (error) {
          console.error('Error fetching assignment history:', error);
        } finally {
          setLoadingHistory(false);
        }
      }
    };

    fetchAssignmentHistory();
  }, [showAssignedTooltip, order.id, userRole]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowAssignedTooltip(false);
      }
    };

    if (showAssignedTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAssignedTooltip]);

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 mb-4 hover:shadow-md transition-shadow relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Order #{order.orderId}
            </h3>
            {isAssigned && (
              <div className="relative" ref={tooltipRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAssignedTooltip(!showAssignedTooltip);
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Click to see assigned user"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Assigned
                </button>
                {showAssignedTooltip && (
                  <div className="absolute z-[9999] bottom-full left-0 mb-2 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 p-3 min-w-[250px] max-w-[300px]">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Assignment History:</div>
                    {loadingHistory ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
                    ) : assignmentHistory.length > 0 ? (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {assignmentHistory.map((assignment, index) => (
                          <div 
                            key={index} 
                            className={`p-2 rounded ${
                              assignment.is_current 
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' 
                                : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {assignment.username || 'Unknown User'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Role: {assignment.role || 'Unknown'}
                                </div>
                                {assignment.assigned_at && (
                                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {new Date(assignment.assigned_at).toLocaleString()}
                                  </div>
                                )}
                              </div>
                              {assignment.is_current && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 rounded">
                                  Current
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {order.assigned_user_name || 'Unknown User'}
                        {order.assigned_user_role && (
                          <div className="text-xs mt-1">Role: {order.assigned_user_role}</div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAssignedTooltip(false);
                      }}
                      className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Close
                    </button>
                    {/* Arrow pointing down */}
                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200 dark:border-t-gray-600"></div>
                    <div className="absolute top-full left-4 mt-[-1px] w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white dark:border-t-gray-700"></div>
                  </div>
                )}
              </div>
            )}
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              order.status === 'delivered' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              order.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {order.status}
            </span>
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {order.paymentStatus}
            </span>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Customer:</span> {order.customerName} <span className="text-gray-400">(ID: {order.customerId})</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Amount:</span> <span className="font-semibold text-gray-900 dark:text-white">{isUpdating ? 'Updating...' : formatCurrency(order.amount)}</span>
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <button
            onClick={() => onToggleExpansion(order.id)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            {isExpanded ? 'Hide' : 'Details'}
          </button>
          
          <button
            onClick={() => onViewCustomerDetails(order.customerId.toString())}
            className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 text-sm font-medium transition-colors"
          >
            Customer
          </button>
          
          {userRole === 'admin' && order.paymentStatus !== 'paid' && (
            <button
              onClick={() => onPaymentClick(order, 'paid')}
              className="px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-sm font-medium transition-colors"
            >
              Mark Paid
            </button>
          )}
          
          {userRole === 'admin' && (
            <>
              <button
                onClick={() => onReturnOrder(order)}
                disabled={order.status === 'returned'}
                className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                  order.status === 'returned'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                }`}
                title={order.status === 'returned' ? 'Order is already returned' : 'Return order'}
              >
                Return
              </button>
              
              <button
                onClick={() => onAssignClick(order)}
                disabled={order.status === 'delivered' || order.status === 'returned' || order.status === 'cancelled'}
                className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                  order.status === 'delivered' || order.status === 'returned' || order.status === 'cancelled'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                }`}
                title={
                  order.status === 'delivered' 
                    ? 'Cannot assign delivered orders' 
                    : order.status === 'returned'
                    ? 'Cannot assign returned orders'
                    : order.status === 'cancelled'
                    ? 'Cannot assign cancelled orders'
                    : 'Assign order to employee'
                }
              >
                Assign
              </button>
            </>
          )}
          
          {canChangeStatus ? (
            <select
              value={order.status}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onStatusUpdate(order.id, e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {/* Always show current status first, even if not in allowed transitions */}
              <option value={order.status} disabled>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)} (Current)
              </option>
              {/* Show allowed status options, excluding current status */}
              {allowedStatuses
                .filter(status => status !== order.status)
                .map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
            </select>
          ) : (
            <span className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
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
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
                Products Ordered
              </p>
              <div className="space-y-2">
                {order.order_items?.map((item, idx) => (
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
                          <p className="text-sm text-gray-900 dark:text-white">{item.quantity} × {formatCurrency(item.price_per_unit)} = <span className="font-semibold">{formatCurrency(item.total_price)}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Payment Status Section in Expanded View */}
          <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Payment Status
              </p>
              <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${
                order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                order.paymentStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                order.paymentStatus === 'refunded' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {order.paymentStatus || 'pending'}
              </span>
            </div>
            {userRole === 'admin' && (
              <div className="flex gap-2">
                <button
                  onClick={() => onPaymentClick(order, 'paid')}
                  disabled={order.paymentStatus === 'paid'}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    order.paymentStatus === 'paid' 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500' 
                      : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                  }`}
                >
                  Mark Paid
                </button>
                <button
                  onClick={() => onPaymentClick(order, 'pending')}
                  disabled={order.paymentStatus === 'pending' || order.paymentStatus === 'paid'}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    order.paymentStatus === 'pending' || order.paymentStatus === 'paid'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500' 
                      : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30'
                  }`}
                >
                  Mark Pending
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


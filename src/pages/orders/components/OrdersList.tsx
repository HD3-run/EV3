// Orders list component

import OrderCard from './OrderCard';
import type { Order } from '../types/order.types';

interface OrdersListProps {
  loading: boolean;
  orders: Order[];
  expandedOrders: Set<string>;
  updatingOrderId: number | null;
  onToggleExpansion: (orderId: string) => void;
  onViewCustomerDetails: (customerId: string) => void;
  onPaymentClick: (order: Order, status: string) => void;
  onReturnOrder: (order: Order) => void;
  onAssignClick: (order: Order) => void;
  onStatusUpdate: (orderId: string, newStatus: string) => void;
  userRole: string;
}

export default function OrdersList({
  loading,
  orders,
  expandedOrders,
  updatingOrderId,
  onToggleExpansion,
  onViewCustomerDetails,
  onPaymentClick,
  onReturnOrder,
  onAssignClick,
  onStatusUpdate,
  userRole
}: OrdersListProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg">No orders found</p>
      </div>
    );
  }

  return (
    <>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          expandedOrders={expandedOrders}
          onToggleExpansion={onToggleExpansion}
          onViewCustomerDetails={onViewCustomerDetails}
          onPaymentClick={onPaymentClick}
          onReturnOrder={onReturnOrder}
          onAssignClick={onAssignClick}
          onStatusUpdate={onStatusUpdate}
          updatingOrderId={updatingOrderId}
          userRole={userRole}
        />
      ))}
    </>
  );
}


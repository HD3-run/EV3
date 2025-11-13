// Metrics cards component

import { formatCurrency } from '../../../utils/currency';

interface MetricsCardsProps {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  todayOrders: number;
}

export default function MetricsCards({
  totalOrders,
  totalRevenue,
  pendingOrders,
  todayOrders
}: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Orders</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalOrders}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Revenue</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pending Orders</p>
        <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{pendingOrders}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">New Orders Today</p>
        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{todayOrders}</p>
      </div>
    </div>
  );
}


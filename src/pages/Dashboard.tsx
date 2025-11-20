import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatCurrency } from '../utils/currency';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { getApiUrl } from '../config/api';

interface ChartData {
  name: string;
  sales: number;
  revenue: number;
  channel?: string;
}

interface DashboardMetrics {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  totalStock: number;
  totalReturns: number;
  totalReturnAmount: number;
}

interface KPIData {
  grossProfit: number;
  profitMargin: number;
  averageOrderValue: number;
  adjustedCOGS: number;
  topSellingProducts: Array<{
    product_name: string;
    sku: string;
    quantity_sold: number;
    revenue: number;
  }>;
  topChannels: Array<{
    channel: string;
    orders: number;
    revenue: number;
    avgOrderValue: number;
  }>;
  summary: {
    totalRevenue: number;
    totalCOGS: number;
    totalOrders: number;
    uniqueCustomers: number;
  };
}

const Dashboard = memo(() => {
  const [, setLocation] = useLocation();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todayOrders: 0,
    todayRevenue: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalStock: 0,
    totalReturns: 0,
    totalReturnAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChannel] = useState('All');
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [calculationData, setCalculationData] = useState<any>(null);
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { isConnected } = useWebSocket();

  const loadKPIData = async () => {
    try {
      const response = await fetch(getApiUrl('/api/reports/kpis'), {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const kpiData = await response.json();
        setKpiData(kpiData);
      } else {
        console.error('Failed to load KPI data');
      }
    } catch (error) {
      console.error('Error loading KPI data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    await loadKPIData();
    setRefreshing(false);
  };

  // Navigation handlers
  const handleLowStockClick = () => {
    setLocation('/inventory?stockStatus=low');
  };

  const handleTodayOrdersClick = () => {
    const today = new Date().toISOString().split('T')[0];
    setLocation(`/orders?date=${today}`);
  };

  const handlePendingOrdersClick = () => {
    setLocation('/orders?status=pending');
  };

  const handleTotalProductsClick = () => {
    setLocation('/inventory');
  };

  // Modal handlers for calculations
  const handleTodayRevenueClick = () => {
    setCalculationData({
      title: 'Today\'s Revenue Calculation',
      description: 'Revenue generated from orders placed today',
      formula: 'Sum of all order amounts where order_date = today',
      value: formatCurrency(metrics.todayRevenue),
      details: [
        { label: 'Today\'s Date', value: new Date().toLocaleDateString() },
        { label: 'Total Revenue', value: formatCurrency(metrics.todayRevenue) },
        { label: 'Orders Count', value: metrics.todayOrders.toString() }
      ]
    });
    setShowCalculationModal(true);
  };

  const handleGrossProfitClick = () => {
    if (!kpiData) return;
    setCalculationData({
      title: 'Gross Profit Calculation',
      description: 'Total revenue minus cost of goods sold',
      formula: 'Gross Profit = Total Revenue - COGS',
      value: formatCurrency(kpiData.grossProfit),
      details: [
        { label: 'Total Revenue', value: formatCurrency(kpiData.summary.totalRevenue) },
        { label: 'Cost of Goods Sold (COGS)', value: formatCurrency(kpiData.summary.totalCOGS) },
        { label: 'Gross Profit', value: formatCurrency(kpiData.grossProfit) }
      ]
    });
    setShowCalculationModal(true);
  };

  const handleProfitMarginClick = () => {
    if (!kpiData) return;
    setCalculationData({
      title: 'Profit Margin Calculation',
      description: 'Percentage of revenue that represents profit',
      formula: 'Profit Margin = (Gross Profit / Total Revenue) × 100',
      value: `${kpiData.profitMargin.toFixed(1)}%`,
      details: [
        { label: 'Gross Profit', value: formatCurrency(kpiData.grossProfit) },
        { label: 'Total Revenue', value: formatCurrency(kpiData.summary.totalRevenue) },
        { label: 'Profit Margin', value: `${kpiData.profitMargin.toFixed(1)}%` }
      ]
    });
    setShowCalculationModal(true);
  };

  const handleAOVClick = () => {
    if (!kpiData) return;
    setCalculationData({
      title: 'Average Order Value (AOV) Calculation',
      description: 'Average value of each order',
      formula: 'AOV = Total Revenue / Total Orders',
      value: formatCurrency(kpiData.averageOrderValue),
      details: [
        { label: 'Total Revenue', value: formatCurrency(kpiData.summary.totalRevenue) },
        { label: 'Total Orders', value: kpiData.summary.totalOrders.toString() },
        { label: 'Average Order Value', value: formatCurrency(kpiData.averageOrderValue) }
      ]
    });
    setShowCalculationModal(true);
  };

  const handleRevenueClick = () => {
    if (!kpiData) return;
    setCalculationData({
      title: 'Total Revenue Calculation',
      description: 'Total revenue generated from all paid orders. This represents the total amount of money received from customers for completed transactions.',
      formula: 'Total Revenue = Sum of all order amounts where payment_status = "paid"',
      value: formatCurrency(kpiData.summary.totalRevenue),
      details: [
        { label: 'Total Orders', value: kpiData.summary.totalOrders.toString() },
        { label: 'Total Revenue', value: formatCurrency(kpiData.summary.totalRevenue) },
        { label: 'Average Order Value', value: formatCurrency(kpiData.averageOrderValue) },
        { label: 'Calculation Method', value: 'Sum of order amounts from paid orders only' },
        { label: 'Data Source', value: 'Orders table with payment_status = "paid"' },
        { label: 'Time Period', value: 'All paid orders (no date filter)' }
      ]
    });
    setShowCalculationModal(true);
  };

  const handleCOGSClick = () => {
    if (!kpiData) return;
    setCalculationData({
      title: 'Cost of Goods Sold (COGS) Calculation',
      description: 'Total cost of products sold in all paid orders, excluding returned orders. This represents the direct costs associated with producing or purchasing the goods that were actually sold to customers.',
      formula: 'COGS = Sum of (quantity × cost_price) for all order items in paid orders (excluding returned orders)',
      value: formatCurrency(kpiData.adjustedCOGS),
      details: [
        { label: 'Total Revenue (Net)', value: formatCurrency(kpiData.summary.totalRevenue) },
        { label: 'Cost of Goods Sold (Adjusted)', value: formatCurrency(kpiData.adjustedCOGS) },
        { label: 'Gross Profit (Adjusted)', value: formatCurrency(kpiData.grossProfit) },
        { label: 'Calculation Method', value: 'Sum of (quantity × cost_price) for each order item' },
        { label: 'Data Source', value: 'Order items joined with inventory cost_price' },
        { label: 'Excludes', value: 'Returned orders, marketing, overhead, administrative expenses' },
        { label: 'Includes', value: 'Product purchase costs, manufacturing costs, direct labor' }
      ]
    });
    setShowCalculationModal(true);
  };

  const handleReturnsClick = () => {
    setCalculationData({
      title: 'Returns Summary',
      description: 'Overview of returned orders and their financial impact on the business.',
      formula: 'Returns = Orders with status "returned"',
      value: `${metrics.totalReturns} returns`,
      details: [
        { label: 'Total Returns', value: metrics.totalReturns.toString() },
        { label: 'Total Return Amount', value: formatCurrency(metrics.totalReturnAmount) },
        { label: 'Return Rate', value: metrics.totalOrders > 0 ? `${((metrics.totalReturns / metrics.totalOrders) * 100).toFixed(1)}%` : '0%' },
        { label: 'Impact on Revenue', value: `-${formatCurrency(metrics.totalReturnAmount)}` }
      ],
      showRedirectButton: true,
      redirectButtonText: 'View Returned Orders',
      redirectPath: '/orders?status=returned'
    });
    setShowCalculationModal(true);
  };

  const loadDashboardData = useCallback(async () => {
    try {
      // Load dashboard metrics from the dedicated dashboard endpoint
      const dashboardResponse = await fetch(getApiUrl('/api/reports/dashboard'), {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();

        // Set metrics from the dashboard API response
        setMetrics({
          todayOrders: dashboardData.todayOrders || 0,
          todayRevenue: dashboardData.todayRevenue || 0,
          pendingOrders: dashboardData.pendingOrders || 0,
          lowStockProducts: dashboardData.lowStockProducts || 0,
          totalOrders: dashboardData.totalOrders || 0,
          totalRevenue: dashboardData.totalRevenue || 0,
          totalProducts: dashboardData.totalProducts || 0,
          totalStock: dashboardData.totalStock || 0,
          totalReturns: dashboardData.totalReturns || 0,
          totalReturnAmount: dashboardData.totalReturnAmount || 0
        });

        // Format chart data from monthly revenue data
        if (dashboardData.monthlyRevenue && Array.isArray(dashboardData.monthlyRevenue)) {
          const formattedData = dashboardData.monthlyRevenue.map((item: any) => ({
            name: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            sales: item.orders || 0,
            revenue: item.revenue || 0,
            channel: 'All'
          }));
          setChartData(formattedData);
        } else {
          // Load monthly chart data as fallback if dashboard endpoint doesn't provide it
          await loadMonthlyData();
        }
      } else {
        // Fallback: try to get basic data from orders endpoint
        await loadFallbackData();
        // Also try to load monthly data
        await loadMonthlyData();
      }

    } catch (error) {
      // Try fallback data loading
      await loadMonthlyData();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const loadFallbackData = async () => {
    try {
      // Load basic orders data as fallback
      const ordersResponse = await fetch(getApiUrl('/api/orders?limit=50000&page=1'), {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const inventoryResponse = await fetch(getApiUrl('/api/inventory?limit=50000'), {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        const orders = ordersData.orders || [];

        const today = new Date().toISOString().split('T')[0];
        const todayOrders = orders.filter((order: any) =>
          order.order_date?.startsWith(today) || order.created_at?.startsWith(today)
        );
        const pendingOrders = orders.filter((order: any) => order.payment_status === 'pending');

        const totalRevenue = orders
          .filter((order: any) => order.status !== 'returned')
          .reduce((sum: number, order: any) =>
            sum + (parseFloat(order.total_amount) || parseFloat(order.display_amount) || 0), 0
          );
        const todayRevenue = todayOrders
          .filter((order: any) => order.status !== 'returned')
          .reduce((sum: number, order: any) =>
            sum + (parseFloat(order.total_amount) || parseFloat(order.display_amount) || 0), 0
          );

        let lowStockCount = 0;
        let totalProducts = 0;
        let totalStock = 0;

        if (inventoryResponse.ok) {
          const inventoryData = await inventoryResponse.json();
          const products = inventoryData.products || [];
          totalProducts = products.length;
          totalStock = products.reduce((sum: number, product: any) => sum + (product.quantity_available || 0), 0);
          lowStockCount = products.filter((product: any) => 
            product.quantity_available <= product.reorder_level
          ).length;
        }

        // Calculate returns data
        const returnedOrders = orders.filter((order: any) => order.status === 'returned');
        const totalReturnAmount = returnedOrders.reduce((sum: number, order: any) =>
          sum + (parseFloat(order.total_amount) || parseFloat(order.display_amount) || 0), 0
        );

        setMetrics({
          todayOrders: todayOrders.length,
          todayRevenue,
          pendingOrders: pendingOrders.length,
          lowStockProducts: lowStockCount,
          totalOrders: orders.length,
          totalRevenue,
          totalProducts,
          totalStock,
          totalReturns: returnedOrders.length,
          totalReturnAmount
        });
      }
    } catch (error) {
      // Silent error handling for fallback
    }
  };

  const loadMonthlyData = async () => {
    try {
      // Load monthly reports data for charts
      const reportsResponse = await fetch(getApiUrl('/api/reports?type=monthly'), {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        if (reportsData.data && Array.isArray(reportsData.data)) {
          const formattedData = reportsData.data.map((item: any) => ({
            name: item.date || item.period_label || 'Unknown',
            sales: item.sales || item.orders || 0,
            revenue: item.revenue || 0,
            channel: 'All'
          }));
          setChartData(formattedData);
        }
      }
    } catch (error) {
      // Silent error handling for monthly data
    }
  };

  useEffect(() => {
    loadDashboardData();
    loadKPIData();
  }, [loadDashboardData]);

  // Refresh metrics when component regains focus (in case user switched tabs)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Dashboard regained focus - refreshing metrics');
      loadDashboardData();
      loadKPIData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadDashboardData]);

  // Listen for order status updates via WebSocket to refresh dashboard metrics
  useEffect(() => {
    if (!isConnected) return;

    const handleOrderStatusUpdate = (data: any) => {
      console.log('📡 Dashboard received WebSocket order status update:', data);
      
      // If it's a payment status update, refresh dashboard metrics
      if (data.paymentStatus && data.orderId) {
        console.log('💳 Dashboard refreshing metrics due to payment update');
        
        // Update metrics immediately based on the payment status change
        if (data.paymentStatus === 'paid') {
          console.log('💰 Dashboard - Payment confirmed, updating revenue metrics');
          setMetrics(prevMetrics => ({
            ...prevMetrics,
            totalRevenue: prevMetrics.totalRevenue + (parseFloat(data.newTotalAmount || data.originalTotalAmount || 0)),
            pendingOrders: Math.max(0, prevMetrics.pendingOrders - 1)
          }));
        } else if (data.paymentStatus === 'pending') {
          console.log('⏳ Dashboard - Payment reverted to pending, updating metrics');
          setMetrics(prevMetrics => ({
            ...prevMetrics,
            totalRevenue: Math.max(0, prevMetrics.totalRevenue - parseFloat(data.originalTotalAmount || 0)),
            pendingOrders: prevMetrics.pendingOrders + 1
          }));
        }
        
        // Also refresh dashboard data as backup
        setTimeout(() => {
          console.log('🔄 Dashboard refreshing data as backup after payment update');
          loadDashboardData();
        }, 1000);
      } else {
        // For other status updates, refresh dashboard data
        console.log('🔄 Dashboard refreshing data due to status update');
        loadDashboardData();
      }
    };

    // Access the socket from the global io object
    const socket = (window as any).io;
    if (socket && socket.connected) {
      socket.on('order-status-updated', handleOrderStatusUpdate);
      
      return () => {
        socket.off('order-status-updated', handleOrderStatusUpdate);
      };
    }
  }, [isConnected, loadDashboardData]);

  const filteredData = useMemo(() => {
    return selectedChannel === 'All'
      ? chartData
      : chartData.filter(data => data.channel === selectedChannel);
  }, [selectedChannel, chartData]);

  return (
    <Layout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl font-bold heading-gradient">Dashboard</h1>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors cta-gradient flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <div 
          className="bg-slate-800/50 p-6 rounded-lg cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={handleTodayOrdersClick}
          title="Click to view today's orders"
        >
          <h3 className="text-sm font-medium text-slate-300">Today's Orders</h3>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 break-words overflow-wrap-anywhere">
            {loading ? (
              <span className="animate-pulse">...</span>
            ) : (
              metrics.todayOrders.toLocaleString()
            )}
          </p>
        </div>
        <div 
          className="bg-slate-800/50 p-6 rounded-lg cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={handleTodayRevenueClick}
          title="Click to view revenue calculation"
        >
          <h3 className="text-sm font-medium text-slate-300">Today's Revenue</h3>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 break-words overflow-wrap-anywhere">
            {loading ? (
              <span className="animate-pulse">...</span>
            ) : (
              formatCurrency(metrics.todayRevenue)
            )}
          </p>
        </div>
        <div 
          className="bg-slate-800/50 p-6 rounded-lg cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={handlePendingOrdersClick}
          title="Click to view pending orders"
        >
          <h3 className="text-sm font-medium text-slate-300">Pending Orders</h3>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 break-words overflow-wrap-anywhere">
            {loading ? (
              <span className="animate-pulse">...</span>
            ) : (
              metrics.pendingOrders.toLocaleString()
            )}
          </p>
        </div>
        <div 
          className="bg-slate-800/50 p-6 rounded-lg cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={handleLowStockClick}
          title="Click to view low stock items"
        >
          <h3 className="text-sm font-medium text-slate-300">Low Stock Items</h3>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 break-words overflow-wrap-anywhere">
            {loading ? (
              <span className="animate-pulse">...</span>
            ) : (
              metrics.lowStockProducts.toLocaleString()
            )}
          </p>
        </div>
        <div 
          className="bg-slate-800/50 p-6 rounded-lg cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={handleTotalProductsClick}
          title="Click to view all products"
        >
          <h3 className="text-sm font-medium text-slate-300">Total Products</h3>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 break-words overflow-wrap-anywhere">
            {loading ? (
              <span className="animate-pulse">...</span>
            ) : (
              metrics.totalProducts.toLocaleString()
            )}
          </p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-lg overflow-hidden">
          <h3 className="text-sm font-medium text-slate-300">Total Stock</h3>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 break-words overflow-wrap-anywhere">
            {loading ? (
              <span className="animate-pulse">...</span>
            ) : (
              metrics.totalStock.toLocaleString()
            )}
          </p>
        </div>
      </div>

      {/* Advanced KPIs Section */}
      {kpiData && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Business KPIs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
            {/* Gross Profit */}
            <div 
              className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-lg shadow-md border border-green-200 dark:border-green-700 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={handleGrossProfitClick}
              title="Click to view calculation details"
            >
              <h3 className="text-sm font-medium text-green-700 dark:text-green-300">Gross Profit</h3>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 break-words overflow-wrap-anywhere">
                {formatCurrency(kpiData.grossProfit)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 break-words">
                Revenue: {formatCurrency(kpiData.summary.totalRevenue)}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 break-words">
                COGS: {formatCurrency(kpiData.summary.totalCOGS)}
              </p>
            </div>

            {/* Profit Margin */}
            <div 
              className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg shadow-md border border-blue-200 dark:border-blue-700 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={handleProfitMarginClick}
              title="Click to view calculation details"
            >
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300">Profit Margin</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 break-words overflow-wrap-anywhere">
                {kpiData.profitMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Gross Profit / Revenue
              </p>
            </div>


            {/* Average Order Value */}
            <div 
              className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-lg shadow-md border border-orange-200 dark:border-orange-700 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={handleAOVClick}
              title="Click to view calculation details"
            >
              <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300">Average Order Value</h3>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 break-words overflow-wrap-anywhere">
                {formatCurrency(kpiData.averageOrderValue)}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Total Revenue / Orders
              </p>
            </div>

            {/* Total Revenue */}
            <div 
              className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-lg shadow-md border border-purple-200 dark:border-purple-700 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={handleRevenueClick}
              title="Click to view calculation details"
            >
              <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300">Total Revenue</h3>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 break-words overflow-wrap-anywhere">
                {formatCurrency(kpiData.summary.totalRevenue)}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Sum of all paid orders
              </p>
            </div>

            {/* Cost of Goods Sold */}
            <div 
              className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 p-6 rounded-lg shadow-md border border-yellow-200 dark:border-yellow-700 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={handleCOGSClick}
              title="Click to view calculation details"
            >
              <h3 className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Cost of Goods Sold</h3>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 break-words overflow-wrap-anywhere">
                {formatCurrency(kpiData.adjustedCOGS)}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                Total product costs
              </p>
            </div>

            {/* Returns */}
            <div 
              className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-lg shadow-md border border-red-200 dark:border-red-700 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={handleReturnsClick}
              title="Click to view returns details"
            >
              <h3 className="text-sm font-medium text-red-700 dark:text-red-300">Returns</h3>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 break-words overflow-wrap-anywhere">
                {metrics.totalReturns}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">
                Amount: {formatCurrency(metrics.totalReturnAmount)}
              </p>
            </div>
          </div>

          {/* Top Products and Channels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling Products */}
            <div className="bg-slate-800/50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-4">Top Selling Products</h3>
              <div className="space-y-3">
                {kpiData.topSellingProducts.slice(0, 5).map((product, index) => (
                  <div key={product.sku} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white text-sm">{product.product_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800 dark:text-white">{product.quantity_sold} units</p>
                      <p className="text-xs text-green-600 dark:text-green-400">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Performing Channels */}
            <div className="bg-slate-800/50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-4">Top Sales Channels</h3>
              <div className="space-y-3">
                {kpiData.topChannels.slice(0, 5).map((channel, index) => (
                  <div key={channel.channel} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white text-sm capitalize">{channel.channel}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{channel.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800 dark:text-white">{formatCurrency(channel.revenue)}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">AOV: {formatCurrency(channel.avgOrderValue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="card-surface p-4 sm:p-6 rounded-card shadow-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Monthly Sales Performance</h2>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg">Loading chart data...</div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg text-gray-500">No sales data available</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4B5563' : '#E5E7EB'} />
                <XAxis dataKey="name" stroke={isDarkMode ? '#D1D5DB' : '#4B5563'} />
                <YAxis stroke={isDarkMode ? '#D1D5DB' : '#4B5563'} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', border: 'none' }} 
                  itemStyle={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}
                />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke={isDarkMode ? '#818CF8' : '#8884d8'} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card-surface p-4 sm:p-6 rounded-card shadow-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Monthly Revenue Breakdown</h2>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg">Loading chart data...</div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg text-gray-500">No revenue data available</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4B5563' : '#E5E7EB'} />
                <XAxis dataKey="name" stroke={isDarkMode ? '#D1D5DB' : '#4B5563'} />
                <YAxis stroke={isDarkMode ? '#D1D5DB' : '#4B5563'} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', border: 'none' }} 
                  itemStyle={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Legend />
                <Bar dataKey="revenue" fill={isDarkMode ? '#34D399' : '#82ca9d'} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Calculation Modal */}
      {showCalculationModal && calculationData && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {calculationData.title}
                </h3>
                <button
                  onClick={() => setShowCalculationModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {calculationData.description}
                </p>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                  <p className="text-sm font-mono text-gray-800 dark:text-gray-200">
                    {calculationData.formula}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {calculationData.value}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Breakdown:</h4>
                {calculationData.details.map((detail: any, index: number) => (
                  <div key={index} className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{detail.label}:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{detail.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                {calculationData.showRedirectButton && (
                  <button
                    onClick={() => {
                      setShowCalculationModal(false);
                      setLocation(calculationData.redirectPath);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    {calculationData.redirectButtonText}
                  </button>
                )}
                <button
                  onClick={() => setShowCalculationModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Layout>
  );
});

export default Dashboard;
// TypeScript interfaces for reports

export interface ReportData {
  date: string;
  sales: number;
  revenue: number;
}

export interface DashboardMetrics {
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
  adjustedCOGS: number;
  grossProfit: number;
  profitMargin: number;
  averageOrderValue: number;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
  channelPerformance: Array<{
    channel: string;
    orders: number;
    revenue: number;
  }>;
  topSellingProducts: Array<{
    product_name: string;
    sku: string;
    quantity_sold: number;
    revenue: number;
  }>;
}

export interface KPIData {
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
  };
}

export interface SalesReportData {
  period: string;
  period_label: string;
  orders: number;
  revenue: number;
  avg_order_value: number;
}

export type ReportType = 'daily' | 'monthly' | 'yearly';
export type GroupByType = 'day' | 'week' | 'month';


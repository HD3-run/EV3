// Dashboard metrics service

import { PoolClient } from 'pg';
import { DashboardMetrics } from '../types/report.types';
import * as dashboardQueries from '../queries/dashboard-queries';

/**
 * Get all dashboard metrics
 */
export async function getDashboardMetrics(
  client: PoolClient,
  merchantId: number
): Promise<DashboardMetrics> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get all dashboard data in parallel
  const todayOrdersQuery = dashboardQueries.getTodayOrdersQuery(merchantId, today);
  const pendingOrdersQuery = dashboardQueries.getPendingOrdersQuery(merchantId);
  const lowStockQuery = dashboardQueries.getLowStockQuery(merchantId);
  const productsQuery = dashboardQueries.getProductsAndStockQuery(merchantId);
  const returnsQuery = dashboardQueries.getReturnsQuery(merchantId);
  const monthlyRevenueQuery = dashboardQueries.getMonthlyRevenueQuery(merchantId);
  const channelPerformanceQuery = dashboardQueries.getChannelPerformanceQuery(merchantId);
  const adjustedCOGSQuery = dashboardQueries.getAdjustedCOGSQuery(merchantId);
  const topProductsQuery = dashboardQueries.getTopProductsQuery(merchantId);

  const [
    todayOrdersResult,
    pendingOrdersResult,
    lowStockResult,
    productsResult,
    returnsResult,
    monthlyRevenueResult,
    channelPerformanceResult,
    adjustedCOGSResult,
    topProductsResult
  ] = await Promise.all([
    client.query(todayOrdersQuery.query, todayOrdersQuery.queryParams),
    client.query(pendingOrdersQuery.query, pendingOrdersQuery.queryParams),
    client.query(lowStockQuery.query, lowStockQuery.queryParams),
    client.query(productsQuery.query, productsQuery.queryParams),
    client.query(returnsQuery.query, returnsQuery.queryParams),
    client.query(monthlyRevenueQuery.query, monthlyRevenueQuery.queryParams),
    client.query(channelPerformanceQuery.query, channelPerformanceQuery.queryParams),
    client.query(adjustedCOGSQuery.query, adjustedCOGSQuery.queryParams),
    client.query(topProductsQuery.query, topProductsQuery.queryParams)
  ]);

  const totalOrders = monthlyRevenueResult.rows.reduce((sum, month) => sum + parseInt(month.orders), 0);
  const totalRevenue = monthlyRevenueResult.rows.reduce((sum, month) => sum + parseFloat(month.revenue), 0);
  const adjustedCOGS = parseFloat(adjustedCOGSResult.rows[0].total_cogs);

  // Calculate adjusted KPIs
  const grossProfit = totalRevenue - adjustedCOGS;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    todayOrders: parseInt(todayOrdersResult.rows[0].count),
    todayRevenue: parseFloat(todayOrdersResult.rows[0].revenue),
    pendingOrders: parseInt(pendingOrdersResult.rows[0].count),
    lowStockProducts: parseInt(lowStockResult.rows[0].count),
    totalOrders,
    totalRevenue,
    totalProducts: parseInt(productsResult.rows[0].total_products),
    totalStock: parseInt(productsResult.rows[0].total_stock),
    totalReturns: parseInt(returnsResult.rows[0].total_returns),
    totalReturnAmount: parseFloat(returnsResult.rows[0].total_return_amount),
    adjustedCOGS,
    grossProfit,
    profitMargin,
    averageOrderValue,
    monthlyRevenue: monthlyRevenueResult.rows,
    channelPerformance: channelPerformanceResult.rows,
    topSellingProducts: topProductsResult.rows
  };
}


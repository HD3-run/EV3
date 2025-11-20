// KPI calculation service

import { PoolClient } from 'pg';
import { KPIData } from '../types/report.types';
import * as kpiQueries from '../queries/kpi-queries';

/**
 * Calculate advanced KPIs
 */
export async function calculateKPIs(
  client: PoolClient,
  merchantId: number
): Promise<KPIData> {
  // Get all KPI data in parallel
  const revenueOrdersQuery = kpiQueries.getRevenueAndOrdersQuery(merchantId);
  const cogsQuery = kpiQueries.getCOGSQuery(merchantId);
  const topProductsQuery = kpiQueries.getTopProductsKPIQuery(merchantId);
  const topChannelsQuery = kpiQueries.getTopChannelsQuery(merchantId);

  const [
    revenueOrdersResult,
    cogsResult,
    topProductsResult,
    topChannelsResult
  ] = await Promise.all([
    client.query(revenueOrdersQuery.query, revenueOrdersQuery.queryParams),
    client.query(cogsQuery.query, cogsQuery.queryParams),
    client.query(topProductsQuery.query, topProductsQuery.queryParams),
    client.query(topChannelsQuery.query, topChannelsQuery.queryParams)
  ]);

  const totalOrders = parseInt(revenueOrdersResult.rows[0].total_orders);
  const totalRevenue = parseFloat(revenueOrdersResult.rows[0].total_revenue);
  const totalCOGS = parseFloat(cogsResult.rows[0].total_cogs);

  // Calculate Gross Profit and Profit Margin
  const grossProfit = totalRevenue - totalCOGS;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Calculate Average Order Value (AOV)
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    grossProfit: Math.round(grossProfit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    adjustedCOGS: Math.round(totalCOGS * 100) / 100,
    topSellingProducts: topProductsResult.rows.map(product => ({
      product_name: product.product_name,
      sku: product.sku,
      quantity_sold: parseInt(product.total_quantity_sold),
      revenue: parseFloat(product.total_revenue)
    })),
    topChannels: topChannelsResult.rows.map(channel => ({
      channel: channel.channel,
      orders: parseInt(channel.total_orders),
      revenue: parseFloat(channel.total_revenue),
      avgOrderValue: parseFloat(channel.avg_order_value)
    })),
    summary: {
      totalRevenue,
      totalCOGS,
      totalOrders
    }
  };
}


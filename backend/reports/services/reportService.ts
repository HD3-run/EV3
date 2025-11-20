// Report generation service

import { PoolClient } from 'pg';
import { ReportData, ReportType } from '../types/report.types';
import * as orderQueries from '../queries/order-queries';

/**
 * Generate report data (daily/monthly/yearly)
 */
export async function generateReport(
  client: PoolClient,
  merchantId: number,
  type: ReportType,
  startDate?: string,
  endDate?: string
): Promise<ReportData[]> {
  let queryResult;
  
  if (type === 'daily') {
    const query = orderQueries.getDailyReportQuery(merchantId, startDate, endDate);
    queryResult = await client.query(query.query, query.queryParams);
  } else if (type === 'monthly') {
    const query = orderQueries.getMonthlyReportQuery(merchantId, startDate, endDate);
    queryResult = await client.query(query.query, query.queryParams);
  } else {
    const query = orderQueries.getYearlyReportQuery(merchantId);
    queryResult = await client.query(query.query, query.queryParams);
  }
  
  const formattedData = queryResult.rows.map(row => ({
    date: row.date,
    sales: parseInt(row.sales) || 0,
    revenue: parseFloat(row.revenue) || 0
  }));
  
  return formattedData;
}


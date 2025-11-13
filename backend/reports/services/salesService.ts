// Sales report service

import { PoolClient } from 'pg';
import { SalesReportData, GroupByType } from '../types/report.types';
import * as salesQueries from '../queries/sales-queries';

/**
 * Get sales report with date filtering and grouping
 */
export async function getSalesReport(
  client: PoolClient,
  merchantId: number,
  startDate?: string,
  endDate?: string,
  channel?: string,
  groupBy: GroupByType = 'day'
): Promise<SalesReportData[]> {
  const query = salesQueries.getSalesReportQuery(merchantId, startDate, endDate, channel, groupBy);
  const result = await client.query(query.query, query.queryParams);
  
  return result.rows;
}


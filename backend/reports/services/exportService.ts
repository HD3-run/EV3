// CSV export service

import { PoolClient } from 'pg';
import * as exportQueries from '../queries/export-queries';

/**
 * Export sales data to CSV format
 */
export async function exportSalesToCSV(
  client: PoolClient,
  merchantId: number,
  startDate?: string,
  endDate?: string,
  channel?: string
): Promise<string> {
  const query = exportQueries.getSalesExportQuery(merchantId, startDate, endDate, channel);
  const result = await client.query(query.query, query.queryParams);
  
  // Convert to CSV
  const headers = ['Order Number', 'Customer Name', 'Email', 'Channel', 'Status', 'Amount', 'Date'];
  const csvData = [
    headers.join(','),
    ...result.rows.map((row: any) => [
      row.order_number,
      row.customer_name,
      row.customer_email,
      row.channel,
      row.status,
      row.total_amount,
      new Date(row.created_at).toISOString().split('T')[0]
    ].join(','))
  ].join('\n');

  return csvData;
}


// Database queries for sales reports

/**
 * Get sales report with date filtering and grouping
 */
export const getSalesReportQuery = (
  merchantId: number,
  startDate?: string,
  endDate?: string,
  channel?: string,
  groupBy: string = 'day'
): { query: string; queryParams: any[] } => {
  let dateFormat = 'YYYY-MM-DD';
  let dateTrunc = 'day';
  
  if (groupBy === 'month') {
    dateFormat = 'YYYY-MM';
    dateTrunc = 'month';
  } else if (groupBy === 'week') {
    dateFormat = 'YYYY-"W"WW';
    dateTrunc = 'week';
  }

  let query = `
    SELECT 
      DATE_TRUNC('${dateTrunc}', created_at) as period,
      TO_CHAR(DATE_TRUNC('${dateTrunc}', created_at), '${dateFormat}') as period_label,
      COUNT(*) as orders,
      SUM(total_amount) as revenue,
      AVG(total_amount) as avg_order_value
    FROM oms.orders 
    WHERE status != 'returned'
  `;
  
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    query += ` AND created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` AND created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  if (channel && channel !== 'all') {
    query += ` AND channel = $${paramIndex}`;
    params.push(channel);
    paramIndex++;
  }

  query += ` GROUP BY DATE_TRUNC('${dateTrunc}', created_at) ORDER BY period`;

  return { query, queryParams: params };
};


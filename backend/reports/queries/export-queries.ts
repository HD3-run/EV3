// Database queries for CSV export

/**
 * Get sales data for CSV export
 */
export const getSalesExportQuery = (
  merchantId: number,
  startDate?: string,
  endDate?: string,
  channel?: string
): { query: string; queryParams: any[] } => {
  let query = `
    SELECT 
      order_number,
      customer_name,
      customer_email,
      channel,
      status,
      total_amount,
      created_at
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

  query += ` ORDER BY created_at DESC`;

  return { query, queryParams: params };
};


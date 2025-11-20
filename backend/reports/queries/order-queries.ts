// Database queries for order-based reports

/**
 * Get daily sales and revenue report
 */
export const getDailyReportQuery = (
  merchantId: number,
  startDate?: string,
  endDate?: string
): { query: string; queryParams: any[] } => {
  let query = `
    SELECT 
      DATE(o.order_date) as date,
      COUNT(o.order_id) as sales,
      COALESCE(SUM(o.total_amount), 0) as revenue
    FROM oms.orders o
    WHERE o.merchant_id = $1
    AND o.payment_status = 'paid'
    AND o.status != 'returned'
  `;
  
  const params: any[] = [merchantId];
  
  if (startDate && endDate) {
    query += ` AND DATE(o.order_date) BETWEEN $2 AND $3`;
    params.push(startDate, endDate);
  } else {
    query += ` AND DATE(o.order_date) >= CURRENT_DATE - INTERVAL '30 days'`;
  }
  
  query += ` GROUP BY DATE(o.order_date) ORDER BY DATE(o.order_date) DESC`;
  
  return { query, queryParams: params };
};

/**
 * Get monthly sales and revenue report
 */
export const getMonthlyReportQuery = (
  merchantId: number,
  startDate?: string,
  endDate?: string
): { query: string; queryParams: any[] } => {
  let query = `
    SELECT 
      TO_CHAR(o.order_date, 'YYYY-MM') as date,
      COUNT(o.order_id) as sales,
      COALESCE(SUM(o.total_amount), 0) as revenue
    FROM oms.orders o
    WHERE o.merchant_id = $1
    AND o.payment_status = 'paid'
    AND o.status != 'returned'
  `;
  
  const params: any[] = [merchantId];
  
  if (startDate && endDate) {
    query += ` AND TO_CHAR(o.order_date, 'YYYY-MM') BETWEEN $2 AND $3`;
    params.push(startDate, endDate);
  } else {
    query += ` AND o.order_date >= CURRENT_DATE - INTERVAL '12 months'`;
  }
  
  query += ` GROUP BY TO_CHAR(o.order_date, 'YYYY-MM') ORDER BY TO_CHAR(o.order_date, 'YYYY-MM') DESC`;
  
  return { query, queryParams: params };
};

/**
 * Get yearly sales and revenue report
 */
export const getYearlyReportQuery = (merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT 
      EXTRACT(YEAR FROM o.order_date)::text as date,
      COUNT(o.order_id) as sales,
      COALESCE(SUM(o.total_amount), 0) as revenue
    FROM oms.orders o
    WHERE o.merchant_id = $1
    AND o.payment_status = 'paid'
    AND o.status != 'returned'
    GROUP BY EXTRACT(YEAR FROM o.order_date)
    ORDER BY EXTRACT(YEAR FROM o.order_date) DESC
  `;
  
  return { query, queryParams: [merchantId] };
};


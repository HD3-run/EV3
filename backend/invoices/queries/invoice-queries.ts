// Database queries for invoices

/**
 * Get invoices with pagination and filtering
 */
export const getInvoicesQuery = (
  merchantId: number,
  search?: string,
  status?: string,
  limit: number = 50,
  offset: number = 0
): { query: string; queryParams: any[] } => {
  let whereClause = 'WHERE i.merchant_id = $1';
  const queryParams: any[] = [merchantId];
  let paramCount = 1;
  
  if (search) {
    paramCount++;
    whereClause += ` AND c.name ILIKE $${paramCount}`;
    queryParams.push(`%${search}%`);
  }
  
  if (status && status !== 'all') {
    paramCount++;
    whereClause += ` AND i.payment_status = $${paramCount}`;
    queryParams.push(status);
  }
  
  const query = `
    SELECT 
      i.invoice_id, 
      i.invoice_number, 
      i.order_id, 
      i.invoice_date, 
      i.due_date,
      i.subtotal, 
      i.tax_amount, 
      i.discount_amount, 
      i.total_amount,
      i.payment_status, 
      i.payment_method, 
      i.pdf_url, 
      i.notes,
      i.created_at,
      i.updated_at,
      c.name as customer_name, 
      o.status as order_status,
      mbd.invoice_prefix,
      COUNT(*) OVER() as total_count
    FROM oms.invoices i
    LEFT JOIN oms.orders o ON i.order_id = o.order_id
    LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
    LEFT JOIN oms.merchant_billing_details mbd ON i.merchant_id = mbd.merchant_id
    ${whereClause}
    ORDER BY i.invoice_date DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;
  
  queryParams.push(limit, offset);
  
  return { query, queryParams };
};

/**
 * Get user merchant ID
 */
export const getUserMerchantIdQuery = (userId: number): { query: string; queryParams: any[] } => {
  return {
    query: 'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
    queryParams: [userId]
  };
};


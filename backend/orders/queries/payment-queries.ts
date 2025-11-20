// Payment-related database queries

/**
 * Check if payment record exists
 */
export const checkPaymentExists = (orderId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT payment_id 
    FROM oms.order_payments 
    WHERE order_id = $1
  `;
  
  return { query, queryParams: [orderId] };
};

/**
 * Update existing payment record
 */
export const updatePayment = (
  orderId: number,
  status: string,
  paymentMethod: string,
  amount: number
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.order_payments 
    SET status = $1, payment_method = $2, amount = $3, payment_date = CURRENT_TIMESTAMP 
    WHERE order_id = $4
  `;
  
  return { query, queryParams: [status, paymentMethod || 'cash', amount, orderId] };
};

/**
 * Create new payment record
 */
export const createPayment = (
  orderId: number,
  status: string,
  paymentMethod: string,
  amount: number
): { query: string; queryParams: any[] } => {
  const query = `
    INSERT INTO oms.order_payments (order_id, status, payment_method, amount, payment_date) 
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
  `;
  
  return { query, queryParams: [orderId, status, paymentMethod || 'cash', amount] };
};

/**
 * Update order payment status and method
 */
export const updateOrderPaymentStatus = (
  orderId: number,
  merchantId: number,
  paymentStatus: string,
  paymentMethod: string,
  orderStatus?: string
): { query: string; queryParams: any[] } => {
  if (orderStatus) {
    const query = `
      UPDATE oms.orders 
      SET payment_status = $1, payment_method = $2, status = $3, updated_at = CURRENT_TIMESTAMP 
      WHERE order_id = $4 AND merchant_id = $5
    `;
    return { query, queryParams: [paymentStatus, paymentMethod || 'cash', orderStatus, orderId, merchantId] };
  } else {
    const query = `
      UPDATE oms.orders 
      SET payment_status = $1, payment_method = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE order_id = $3 AND merchant_id = $4
    `;
    return { query, queryParams: [paymentStatus, paymentMethod || 'cash', orderId, merchantId] };
  }
};

/**
 * Get payment status for order
 */
export const getPaymentStatus = (orderId: number, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT payment_status 
    FROM oms.orders 
    WHERE order_id = $1 AND merchant_id = $2
  `;
  
  return { query, queryParams: [orderId, merchantId] };
};


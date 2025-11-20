// Employee/assignment-related database queries

/**
 * Get user info (merchant_id, role)
 */
export const getUserInfo = (userId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT merchant_id, role 
    FROM oms.users 
    WHERE user_id = $1
  `;
  
  return { query, queryParams: [userId] };
};

/**
 * Get user info with username (for debug)
 */
export const getUserInfoWithUsername = (userId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT merchant_id, role, username 
    FROM oms.users 
    WHERE user_id = $1
  `;
  
  return { query, queryParams: [userId] };
};

/**
 * Get merchant ID from user
 */
export const getMerchantId = (userId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT merchant_id 
    FROM oms.users 
    WHERE user_id = $1
  `;
  
  return { query, queryParams: [userId] };
};

/**
 * Update order assignment (user_id and status)
 */
export const assignOrderToUser = (
  orderId: number,
  merchantId: number,
  userId: number,
  status: string
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.orders 
    SET user_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP 
    WHERE order_id = $3 AND merchant_id = $4
  `;
  
  return { query, queryParams: [userId, status, orderId, merchantId] };
};

/**
 * Get all users for a merchant (for employee list)
 */
export const getMerchantUsers = (merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT user_id, username, role 
    FROM oms.users 
    WHERE merchant_id = $1
  `;
  
  return { query, queryParams: [merchantId] };
};

/**
 * Get assigned orders for a user
 */
export const getAssignedOrders = (merchantId: number, userId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT o.order_id, o.order_source, o.total_amount, o.status, o.created_at, c.name as customer_name 
    FROM oms.orders o 
    LEFT JOIN oms.customers c ON o.customer_id = c.customer_id 
    WHERE o.merchant_id = $1 AND o.user_id = $2
  `;
  
  return { query, queryParams: [merchantId, userId] };
};

/**
 * Get assigned orders for employee (shipped status only)
 */
export const getAssignedOrdersQuery = (userId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT o.order_id, o.order_date, o.total_amount, o.status, o.order_source,
           c.name as customer_name, c.phone as customer_phone, c.address as delivery_address
    FROM oms.orders o
    LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
    WHERE o.user_id = $1 AND o.status = 'shipped'
    ORDER BY o.order_date DESC
  `;
  
  return { query, queryParams: [userId] };
};

/**
 * Get all orders assigned to employee
 */
export const getEmployeeOrdersQuery = (userId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT o.order_id, o.order_date, o.total_amount, o.status, o.order_source,
           c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as delivery_address
    FROM oms.orders o
    LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
    WHERE o.user_id = $1
    ORDER BY o.order_date DESC
  `;
  
  return { query, queryParams: [userId] };
};

/**
 * Get order with user assignment check
 */
export const getOrderForEmployeeQuery = (
  orderId: number,
  userId: number
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT status, payment_status
    FROM oms.orders
    WHERE order_id = $1 AND user_id = $2
  `;
  
  return { query, queryParams: [orderId, userId] };
};

/**
 * Get user role
 */
export const getUserRoleQuery = (userId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT role
    FROM oms.users
    WHERE user_id = $1
  `;
  
  return { query, queryParams: [userId] };
};

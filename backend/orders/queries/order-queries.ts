// Order-related database queries

import { PoolClient } from 'pg';

export interface OrderQueryParams {
  merchantId: number;
  userId?: number;
  role?: string;
  page?: number;
  limit?: number;
  status?: string;
  channel?: string;
  search?: string;
  date?: string;
}

/**
 * Get all orders with pagination and filtering
 * Optimized single query with proper JOINs to eliminate N+1 problems
 */
export const getOrdersQuery = (params: OrderQueryParams): { query: string; queryParams: any[] } => {
  const {
    merchantId,
    userId,
    role,
    page = 1,
    limit = 10,
    status,
    channel,
    search,
    date
  } = params;

  const offset = (Number(page) - 1) * Number(limit);
  const limitNum = Number(limit) || 10;

  let query = `
    SELECT 
      o.order_id, 
      o.customer_id, 
      o.order_source, 
      o.total_amount, 
      o.status,
      o.payment_status, 
      o.payment_method, 
      o.created_at, 
      o.updated_at,
      o.user_id,
      c.name as customer_name, 
      c.phone as customer_phone, 
      c.email as customer_email,
      u.username as assigned_user_name,
      u.role as assigned_user_role,
      COALESCE(p.amount, 0.00) as paid_amount,
      COALESCE(oi_summary.total_price, 0.00) as display_amount,
      COUNT(*) OVER() as total_count,
      COALESCE(oi_items.items_json, '[]'::json) as order_items
    FROM oms.orders o
    LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
    LEFT JOIN oms.users u ON o.user_id = u.user_id
    LEFT JOIN oms.order_payments p ON o.order_id = p.order_id
    LEFT JOIN (
      SELECT order_id, SUM(total_price) as total_price
      FROM oms.order_items
      GROUP BY order_id
    ) oi_summary ON o.order_id = oi_summary.order_id
    LEFT JOIN (
      SELECT 
        oi.order_id,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'product_id', oi.product_id,
            'product_name', pr.product_name,
            'quantity', oi.quantity,
            'price_per_unit', oi.price_per_unit,
            'total_price', oi.total_price,
            'sku', oi.sku
          )
        ) as items_json
      FROM oms.order_items oi
      LEFT JOIN oms.products pr ON oi.product_id = pr.product_id
      GROUP BY oi.order_id
    ) oi_items ON o.order_id = oi_items.order_id
    WHERE o.merchant_id = $1
  `;
  
  const queryParams: any[] = [merchantId];
  let paramIndex = 2;
  
  // If user is not admin, only show their assigned orders
  if (role !== 'admin' && userId) {
    query += ` AND o.user_id = $${paramIndex}`;
    queryParams.push(userId);
    paramIndex++;
  }

  if (status && status !== 'all') {
    // Special handling for "assigned" filter - check if order has a user_id (is assigned)
    // This is different from status='assigned' because assignment doesn't change status anymore
    if (status === 'assigned') {
      query += ` AND o.user_id IS NOT NULL`;
      // No parameter needed for this condition
      // Note: This will return all orders that have been assigned to any user,
      // regardless of their current status (confirmed, shipped, etc.)
    } else {
      query += ` AND o.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }
  }

  if (channel && channel !== 'all') {
    query += ` AND o.order_source = $${paramIndex}`;
    queryParams.push(channel);
    paramIndex++;
  }

  if (search) {
    // Search by order_id, customer_id, or customer name
    query += ` AND (
      o.order_id::text ILIKE $${paramIndex} OR 
      o.customer_id::text ILIKE $${paramIndex} OR 
      c.name ILIKE $${paramIndex}
    )`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (date) {
    query += ` AND DATE(o.order_date) = $${paramIndex}`;
    queryParams.push(date);
    paramIndex++;
  }

  query += ` ORDER BY o.order_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limitNum, offset);

  return { query, queryParams };
};

/**
 * Get complete order data with customer info (for order creation response)
 */
export const getCompleteOrderQuery = (orderId: number, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT o.order_id, o.customer_id, o.order_source, o.total_amount, o.status,
           o.payment_status, o.payment_method, o.created_at, o.updated_at,
           c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
           COALESCE((
             SELECT SUM(oi.total_price)
             FROM oms.order_items oi
             WHERE oi.order_id = o.order_id
           ), 0.00) as display_amount,
           COALESCE((
             SELECT JSON_AGG(
               JSON_BUILD_OBJECT(
                 'product_id', oi.product_id,
                 'product_name', pr.product_name,
                 'quantity', oi.quantity,
                 'price_per_unit', oi.price_per_unit,
                 'total_price', oi.total_price,
                 'sku', oi.sku
               )
             )
             FROM oms.order_items oi
             LEFT JOIN oms.products pr ON oi.product_id = pr.product_id
             WHERE oi.order_id = o.order_id
           ), '[]'::json) as order_items
    FROM oms.orders o
    LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
    WHERE o.order_id = $1 AND o.merchant_id = $2
  `;
  
  return { query, queryParams: [orderId, merchantId] };
};

/**
 * Get order details with customer state (for invoice creation)
 */
export const getOrderDetailsWithCustomerState = (orderId: number, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT o.order_id, o.total_amount, o.customer_id, o.status, c.state_code as customer_state_code
    FROM oms.orders o 
    LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
    WHERE o.order_id = $1 AND o.merchant_id = $2
  `;
  
  return { query, queryParams: [orderId, merchantId] };
};

/**
 * Check if order exists and belongs to merchant
 */
export const checkOrderExists = (orderId: number, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT order_id, total_amount, payment_status, status 
    FROM oms.orders 
    WHERE order_id = $1 AND merchant_id = $2
  `;
  
  return { query, queryParams: [orderId, merchantId] };
};

/**
 * Get order status for validation
 */
export const getOrderStatus = (orderId: number, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT status 
    FROM oms.orders 
    WHERE order_id = $1 AND merchant_id = $2
  `;
  
  return { query, queryParams: [orderId, merchantId] };
};


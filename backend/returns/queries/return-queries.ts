// Return queries for returns module

/**
 * Get all returns with pagination
 */
export const getReturnsQuery = (
  merchantId: number,
  limit: number,
  offset: number
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT 
      r.return_id,
      r.order_id,
      r.customer_id,
      r.reason,
      r.total_refund_amount,
      r.approval_status,
      r.receipt_status,
      r.status,
      r.return_date,
      r.created_at,
      r.updated_at,
      o.order_date,
      o.total_amount as order_total,
      c.name as customer_name,
      c.phone as customer_phone,
      c.email as customer_email,
      COUNT(*) OVER() as total_count,
      COALESCE(
        json_agg(
          json_build_object(
            'return_item_id', ri.return_item_id,
            'quantity', ri.quantity,
            'unit_price', ri.unit_price,
            'total_amount', ri.total_amount,
            'product_name', p.product_name,
            'sku', p.sku,
            'brand', p.brand,
            'category', p.category
          )
        ) FILTER (WHERE ri.return_item_id IS NOT NULL),
        '[]'::json
      ) as return_items
    FROM oms.order_returns r
    LEFT JOIN oms.orders o ON r.order_id = o.order_id
    LEFT JOIN oms.customers c ON r.customer_id = c.customer_id
    LEFT JOIN oms.order_return_items ri ON r.return_id = ri.return_id
    LEFT JOIN oms.products p ON ri.product_id = p.product_id
    WHERE r.merchant_id = $1
    GROUP BY r.return_id, r.order_id, r.customer_id, r.reason, r.total_refund_amount,
             r.approval_status, r.receipt_status, r.status, r.return_date, r.created_at, r.updated_at,
             o.order_date, o.total_amount, c.name, c.phone, c.email
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  
  return { query, queryParams: [merchantId, limit, offset] };
};

/**
 * Get single return by ID
 */
export const getReturnByIdQuery = (
  returnId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT 
      r.return_id,
      r.order_id,
      r.customer_id,
      r.reason,
      r.total_refund_amount,
      r.approval_status,
      r.receipt_status,
      r.status,
      r.return_date,
      r.created_at,
      r.updated_at,
      o.order_date,
      o.total_amount as order_total,
      c.name as customer_name,
      c.phone as customer_phone,
      c.email as customer_email,
      COALESCE(
        json_agg(
          json_build_object(
            'return_item_id', ri.return_item_id,
            'quantity', ri.quantity,
            'unit_price', ri.unit_price,
            'total_amount', ri.total_amount,
            'product_name', p.product_name,
            'sku', p.sku,
            'brand', p.brand,
            'category', p.category
          )
        ) FILTER (WHERE ri.return_item_id IS NOT NULL),
        '[]'::json
      ) as return_items
    FROM oms.order_returns r
    LEFT JOIN oms.orders o ON r.order_id = o.order_id
    LEFT JOIN oms.customers c ON r.customer_id = c.customer_id
    LEFT JOIN oms.order_return_items ri ON r.return_id = ri.return_id
    LEFT JOIN oms.products p ON ri.product_id = p.product_id
    WHERE r.return_id = $1 AND r.merchant_id = $2
    GROUP BY r.return_id, r.order_id, r.customer_id, r.reason, r.total_refund_amount,
             r.approval_status, r.receipt_status, r.status, r.return_date, r.created_at, r.updated_at,
             o.order_date, o.total_amount, c.name, c.phone, c.email
  `;
  
  return { query, queryParams: [returnId, merchantId] };
};


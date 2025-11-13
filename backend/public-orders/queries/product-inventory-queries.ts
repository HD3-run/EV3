// Product and inventory queries for public orders

/**
 * Get product and inventory details for order item
 */
export const getProductInventoryQuery = (
  productId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT 
      p.product_id, 
      p.product_name, 
      p.sku, 
      i.inventory_id, 
      i.quantity_available 
    FROM oms.products p 
    INNER JOIN oms.inventory i ON p.product_id = i.product_id 
    WHERE p.product_id = $1 AND p.merchant_id = $2
  `;
  
  return { query, queryParams: [productId, merchantId] };
};

/**
 * Update inventory quantity after order
 */
export const updateInventoryQuantityQuery = (
  quantity: number,
  productId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.inventory 
    SET quantity_available = quantity_available - $1
    WHERE product_id = $2 AND merchant_id = $3
  `;
  
  return { query, queryParams: [quantity, productId, merchantId] };
};

/**
 * Get updated inventory quantity for WebSocket notification
 */
export const getUpdatedInventoryQuery = (
  productId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT quantity_available 
    FROM oms.inventory 
    WHERE product_id = $1 AND merchant_id = $2
  `;
  
  return { query, queryParams: [productId, merchantId] };
};


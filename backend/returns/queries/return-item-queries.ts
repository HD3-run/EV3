// Return item queries for returns module

/**
 * Get return items for a single return (for WebSocket notifications and inventory restock)
 */
export const getReturnItemsQuery = (
  returnId: number
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT 
      ri.product_id,
      ri.quantity,
      ri.inventory_id,
      p.product_name,
      p.sku,
      r.merchant_id
    FROM oms.order_return_items ri
    INNER JOIN oms.order_returns r ON ri.return_id = r.return_id
    LEFT JOIN oms.products p ON ri.product_id = p.product_id
    WHERE ri.return_id = $1
  `;
  
  return { query, queryParams: [returnId] };
};

/**
 * Get return items for multiple returns (for bulk WebSocket notifications)
 */
export const getBulkReturnItemsQuery = (
  returnIds: number[]
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT 
      ri.return_id,
      ri.product_id,
      ri.quantity,
      ri.inventory_id,
      p.product_name,
      p.sku,
      r.merchant_id
    FROM oms.order_return_items ri
    INNER JOIN oms.order_returns r ON ri.return_id = r.return_id
    LEFT JOIN oms.products p ON ri.product_id = p.product_id
    WHERE ri.return_id = ANY($1)
  `;
  
  return { query, queryParams: [returnIds] };
};

/**
 * Restock inventory for a returned product
 */
export const restockInventoryQuery = (
  quantity: number,
  productId: number,
  merchantId: number
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.inventory 
    SET quantity_available = quantity_available + $1
    WHERE product_id = $2 AND merchant_id = $3
  `;
  
  return { query, queryParams: [quantity, productId, merchantId] };
};

/**
 * Get updated inventory quantity after restock
 */
export const getUpdatedInventoryAfterRestockQuery = (
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


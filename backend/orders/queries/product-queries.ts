// Product/inventory-related database queries

/**
 * Find product in inventory by ID
 */
export const findProductById = (productId: number, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT p.product_id, p.product_name, i.inventory_id, i.quantity_available, i.cost_price 
    FROM oms.products p 
    JOIN oms.inventory i ON p.product_id = i.product_id 
    WHERE p.product_id = $1 AND p.merchant_id = $2
  `;
  
  return { query, queryParams: [productId, merchantId] };
};

/**
 * Find product in inventory by name
 */
export const findProductByName = (productName: string, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT p.product_id, p.product_name, i.inventory_id, i.quantity_available, i.cost_price 
    FROM oms.products p 
    JOIN oms.inventory i ON p.product_id = i.product_id 
    WHERE p.product_name = $1 AND p.merchant_id = $2
  `;
  
  return { query, queryParams: [productName, merchantId] };
};

/**
 * Get inventory_id for a product
 */
export const getInventoryId = (productId: number, merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT inventory_id 
    FROM oms.inventory 
    WHERE product_id = $1 AND merchant_id = $2
  `;
  
  return { query, queryParams: [productId, merchantId] };
};

/**
 * Update inventory quantity (deduct)
 */
export const updateInventoryQuantity = (
  productId: number,
  merchantId: number,
  quantity: number
): { query: string; queryParams: any[] } => {
  const query = `
    UPDATE oms.inventory 
    SET quantity_available = quantity_available - $1 
    WHERE product_id = $2 AND merchant_id = $3
  `;
  
  return { query, queryParams: [quantity, productId, merchantId] };
};

/**
 * Batch validate products exist in inventory
 */
export const batchValidateProducts = (productNames: string[], merchantId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT p.product_name, p.product_id, i.inventory_id, i.quantity_available, i.cost_price, p.sku
    FROM oms.products p 
    JOIN oms.inventory i ON p.product_id = i.product_id 
    WHERE p.product_name = ANY($1) AND p.merchant_id = $2
  `;
  
  return { query, queryParams: [productNames, merchantId] };
};

/**
 * Batch update inventory (with safety check to prevent negative stock)
 */
export const batchUpdateInventory = (
  updates: Array<{ productId: number; quantity: number }>,
  merchantId: number
): { queries: Array<{ query: string; queryParams: any[] }> } => {
  const queries = updates.map(update => ({
    query: `
      UPDATE oms.inventory 
      SET quantity_available = GREATEST(0, quantity_available - $1) 
      WHERE product_id = $2 AND merchant_id = $3
    `,
    queryParams: [update.quantity, update.productId, merchantId]
  }));
  
  return { queries };
};

/**
 * Get inventory_id from inventory table for return processing
 */
export const getInventoryIdForProduct = (merchantId: number, productId: number): { query: string; queryParams: any[] } => {
  const query = `
    SELECT inventory_id 
    FROM oms.inventory 
    WHERE merchant_id = $1 AND product_id = $2
  `;
  
  return { query, queryParams: [merchantId, productId] };
};


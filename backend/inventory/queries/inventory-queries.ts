// Inventory stock-related SQL queries

export async function updateInventoryStock(
  client: any,
  productId: number,
  merchantId: number,
  quantity: number
) {
  const result = await client.query(
    `UPDATE oms.inventory 
     SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE product_id = $2 AND merchant_id = $3 
     RETURNING *`,
    [quantity, productId, merchantId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function updateInventoryBySku(
  client: any,
  sku: string,
  merchantId: number,
  quantity: number
) {
  const result = await client.query(
    `UPDATE oms.inventory 
     SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP
     WHERE sku = $2 AND merchant_id = $3
     RETURNING *`,
    [quantity, sku, merchantId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function updateInventoryByProductName(
  client: any,
  productName: string,
  merchantId: number,
  quantity: number
) {
  const result = await client.query(
    `UPDATE oms.inventory 
     SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE merchant_id = $2 AND product_id IN (
       SELECT product_id FROM oms.products WHERE product_name = $3 AND merchant_id = $2
     ) 
     RETURNING *`,
    [quantity, merchantId, productName]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function createInventoryRecord(
  client: any,
  merchantId: number,
  productId: number,
  sku: string,
  stock: number,
  reorderLevel: number,
  unitPrice: number,
  sellingPrice: number
) {
  await client.query(
    `INSERT INTO oms.inventory (merchant_id, product_id, sku, quantity_available, reorder_level, cost_price, selling_price) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [merchantId, productId, sku, stock, reorderLevel, unitPrice || 0, sellingPrice || 0]
  );
}

export async function updateReorderLevel(
  client: any,
  productId: number,
  merchantId: number,
  reorderLevel: number
) {
  const result = await client.query(
    `UPDATE oms.inventory 
     SET reorder_level = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE product_id = $2 AND merchant_id = $3 
     RETURNING *`,
    [reorderLevel, productId, merchantId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}


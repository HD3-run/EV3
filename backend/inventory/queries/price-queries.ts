// Price update SQL queries

export async function updateProductPrice(
  client: any,
  productId: number,
  merchantId: number,
  unitPrice: number
) {
  const result = await client.query(
    `UPDATE oms.inventory 
     SET cost_price = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE product_id = $2 AND merchant_id = $3 
     RETURNING *`,
    [unitPrice, productId, merchantId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function updateSellingPrice(
  client: any,
  productId: number,
  merchantId: number,
  sellingPrice: number
) {
  const result = await client.query(
    `UPDATE oms.inventory 
     SET selling_price = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE product_id = $2 AND merchant_id = $3 
     RETURNING *`,
    [sellingPrice, productId, merchantId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}


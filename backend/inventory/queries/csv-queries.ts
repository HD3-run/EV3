// CSV processing SQL queries

export async function batchInsertProducts(
  client: any,
  merchantId: number,
  products: Array<{
    name: string;
    category: string;
    brand: string | null;
    description: string | null;
    hsn_code: string | null;
    gst_rate: number;
  }>
) {
  const productValues = products.map((_, index) => 
    `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
  ).join(', ');
  
  const productParams = products.flatMap(product => [
    merchantId,
    product.name,
    product.category || 'Uncategorized',
    product.brand || null,
    product.description || null,
    product.hsn_code || null,
    product.gst_rate || 18.00
  ]);

  const productQuery = `
    INSERT INTO oms.products (merchant_id, product_name, category, brand, description, hsn_code, gst_rate) 
    VALUES ${productValues} 
    ON CONFLICT (merchant_id, product_name) DO UPDATE SET
      category = EXCLUDED.category,
      brand = EXCLUDED.brand,
      description = EXCLUDED.description,
      hsn_code = EXCLUDED.hsn_code,
      gst_rate = EXCLUDED.gst_rate,
      updated_at = CURRENT_TIMESTAMP
    RETURNING product_id, sku, product_name
  `;

  const result = await client.query(productQuery, productParams);
  return result.rows;
}

export async function batchInsertInventory(
  client: any,
  merchantId: number,
  productResults: Array<{ product_id: number; sku: string; product_name: string }>,
  batchData: Array<{
    stock: number;
    reorderLevel: number;
    unitPrice: number;
    sellingPrice: number;
  }>
) {
  const inventoryValues = productResults.map((_, index) => 
    `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
  ).join(', ');

  const inventoryParams = productResults.flatMap((product, index) => [
    merchantId,
    product.product_id,
    product.sku,
    batchData[index].stock || 0,
    batchData[index].reorderLevel || 0,
    batchData[index].unitPrice || 0,
    batchData[index].sellingPrice || 0
  ]);

  const inventoryQuery = `
    INSERT INTO oms.inventory (merchant_id, product_id, sku, quantity_available, reorder_level, cost_price, selling_price) 
    VALUES ${inventoryValues}
    ON CONFLICT (merchant_id, product_id) DO UPDATE SET
      quantity_available = EXCLUDED.quantity_available,
      reorder_level = EXCLUDED.reorder_level,
      cost_price = EXCLUDED.cost_price,
      selling_price = EXCLUDED.selling_price,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const result = await client.query(inventoryQuery, inventoryParams);
  return result.rows;
}


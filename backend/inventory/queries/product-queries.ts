// Product-related SQL queries

export async function getUserMerchantId(client: any, userId: string) {
  const result = await client.query(
    'SELECT merchant_id FROM oms.users WHERE user_id = $1',
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0].merchant_id : null;
}

export async function getProductsWithFilters(
  client: any,
  merchantId: number,
  params: {
    page: number;
    limit: number;
    category?: string;
    search?: string;
    lowStock?: string;
    stockStatus?: string;
  }
) {
  const { page, limit, category, search, lowStock, stockStatus } = params;
  const offset = (page - 1) * limit;

  let query = `
    SELECT p.product_id, p.merchant_id, p.product_name, p.sku, p.description, p.category, p.brand, p.hsn_code, p.gst_rate, p.created_at,
           i.quantity_available, i.reorder_level, i.cost_price as unit_price, i.selling_price,
           (i.quantity_available <= i.reorder_level) as is_low_stock,
           COUNT(*) OVER() as total_count
    FROM oms.products p
    INNER JOIN oms.inventory i ON p.product_id = i.product_id
    WHERE p.merchant_id = $1
  `;
  const queryParams: any[] = [merchantId];
  let paramIndex = 2;

  if (category && category !== 'all') {
    query += ` AND p.category = $${paramIndex}`;
    queryParams.push(category);
    paramIndex++;
  }

  if (search) {
    query += ` AND (
      p.product_name ILIKE $${paramIndex} OR 
      p.sku ILIKE $${paramIndex + 1} OR 
      p.product_id::text ILIKE $${paramIndex + 2}
    )`;
    queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    paramIndex += 3;
  }

  if (lowStock === 'true') {
    query += ` AND i.quantity_available <= i.reorder_level`;
  }

  if (stockStatus === 'low') {
    query += ` AND i.quantity_available <= i.reorder_level`;
  } else if (stockStatus === 'in') {
    query += ` AND i.quantity_available > i.reorder_level`;
  }

  query += ` ORDER BY p.product_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  const result = await client.query(query, queryParams);
  return result;
}

export async function checkDuplicateSku(client: any, merchantId: number, sku: string) {
  const result = await client.query(
    'SELECT product_id FROM oms.products WHERE merchant_id = $1 AND sku = $2',
    [merchantId, sku]
  );
  return result.rows.length > 0;
}

export async function createProduct(
  client: any,
  merchantId: number,
  productData: {
    name: string;
    sku: string | null;
    description: string | null;
    category: string;
    hsn_code: string | null;
    gst_rate: number;
  }
) {
  const result = await client.query(
    `INSERT INTO oms.products (merchant_id, product_name, sku, description, category, hsn_code, gst_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      merchantId,
      productData.name,
      productData.sku,
      productData.description,
      productData.category,
      productData.hsn_code || null,
      productData.gst_rate || 18.00
    ]
  );
  return result.rows[0];
}

export async function updateProduct(
  client: any,
  productId: number,
  merchantId: number,
  productData: {
    name: string;
    sku: string;
    description: string | null;
    category: string;
    hsn_code: string | null;
    gst_rate: number;
  }
) {
  const result = await client.query(
    `UPDATE oms.products 
     SET product_name = $1, sku = $2, description = $3, category = $4, hsn_code = $5, gst_rate = $6, updated_at = CURRENT_TIMESTAMP
     WHERE product_id = $7 AND merchant_id = $8
     RETURNING *`,
    [
      productData.name,
      productData.sku,
      productData.description,
      productData.category,
      productData.hsn_code || null,
      productData.gst_rate || 18.00,
      productId,
      merchantId
    ]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getLowStockProducts(client: any, merchantId: number) {
  const result = await client.query(
    `SELECT p.product_id, p.merchant_id, p.product_name, p.sku, p.description, p.category, p.brand, p.hsn_code, p.gst_rate, p.created_at,
            i.quantity_available, i.reorder_level, i.cost_price as unit_price,
            (i.quantity_available <= i.reorder_level) as is_low_stock
     FROM oms.products p 
     JOIN oms.inventory i ON p.product_id = i.product_id
     WHERE p.merchant_id = $1 AND i.quantity_available <= i.reorder_level
     ORDER BY i.quantity_available ASC`,
    [merchantId]
  );
  return result.rows;
}

export async function checkExactDuplicate(
  client: any,
  merchantId: number,
  name: string,
  brand: string | null
) {
  const result = await client.query(
    'SELECT product_id, product_name, brand FROM oms.products WHERE merchant_id = $1 AND product_name = $2 AND (brand = $3 OR (brand IS NULL AND $3 IS NULL))',
    [merchantId, name, brand || null]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function checkNameConflict(
  client: any,
  merchantId: number,
  name: string
) {
  const result = await client.query(
    'SELECT product_id, product_name, brand FROM oms.products WHERE merchant_id = $1 AND product_name = $2',
    [merchantId, name]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function checkModifiedNameConflict(
  client: any,
  merchantId: number,
  modifiedName: string
) {
  const result = await client.query(
    'SELECT product_id, product_name, brand FROM oms.products WHERE merchant_id = $1 AND product_name = $2',
    [merchantId, modifiedName]
  );
  return result.rows.length > 0;
}

export async function createProductWithInventory(
  client: any,
  merchantId: number,
  productData: {
    name: string;
    category: string;
    brand: string | null;
    description: string | null;
    hsn_code: string | null;
    gst_rate: number;
  }
) {
  const result = await client.query(
    `INSERT INTO oms.products (merchant_id, product_name, category, brand, description, hsn_code, gst_rate) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING product_id, sku`,
    [
      merchantId,
      productData.name,
      productData.category,
      productData.brand || null,
      productData.description || null,
      productData.hsn_code || null,
      productData.gst_rate || 18.00
    ]
  );
  return result.rows[0];
}

export async function updateProductPartial(
  client: any,
  productId: number,
  merchantId: number,
  updateFields: string[],
  updateValues: any[]
) {
  // Count only fields with parameters (exclude fields like 'updated_at = CURRENT_TIMESTAMP')
  const paramCount = updateValues.length;
  updateValues.push(productId, merchantId);
  const result = await client.query(
    `UPDATE oms.products SET ${updateFields.join(', ')} WHERE product_id = $${paramCount + 1} AND merchant_id = $${paramCount + 2} RETURNING *`,
    updateValues
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}


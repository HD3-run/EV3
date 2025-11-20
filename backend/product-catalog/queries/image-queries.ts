import { PoolClient } from 'pg';

// Verify product belongs to merchant
export async function verifyProductOwnership(
  client: PoolClient,
  productId: number,
  merchantId: number
): Promise<boolean> {
  const result = await client.query(
    'SELECT product_id FROM oms.products WHERE product_id = $1 AND merchant_id = $2',
    [productId, merchantId]
  );
  return result.rows.length > 0;
}

// Get image details including s3_key
export async function getImageDetails(
  client: PoolClient,
  catalogueId: number,
  productId: number
): Promise<{ s3_key: string } | null> {
  const result = await client.query(
    'SELECT s3_key FROM oms.product_catalogue WHERE catalogue_id = $1 AND product_id = $2',
    [catalogueId, productId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Check if image is primary
export async function checkImageIsPrimary(
  client: PoolClient,
  catalogueId: number,
  productId: number
): Promise<boolean> {
  const result = await client.query(
    'SELECT is_primary FROM oms.product_catalogue WHERE catalogue_id = $1 AND product_id = $2',
    [catalogueId, productId]
  );
  return result.rows.length > 0 && result.rows[0].is_primary;
}

// Get first remaining image after deletion
export async function getFirstRemainingImage(
  client: PoolClient,
  productId: number
): Promise<{ catalogue_id: number } | null> {
  const result = await client.query(
    `SELECT catalogue_id FROM oms.product_catalogue 
     WHERE product_id = $1 AND status = 'active' 
     ORDER BY display_order ASC, catalogue_id ASC 
     LIMIT 1`,
    [productId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Verify image exists and belongs to product
export async function verifyImageOwnership(
  client: PoolClient,
  catalogueId: number,
  productId: number
): Promise<boolean> {
  const result = await client.query(
    'SELECT catalogue_id FROM oms.product_catalogue WHERE catalogue_id = $1 AND product_id = $2 AND status = $3',
    [catalogueId, productId, 'active']
  );
  return result.rows.length > 0;
}


import { PoolClient } from 'pg';

// Update product tags
export async function updateProductTagsService(
  client: PoolClient,
  productId: number,
  merchantId: number,
  userId: number | string,
  tags: any[]
): Promise<any> {
  if (!Array.isArray(tags)) {
    throw new Error('Tags must be an array');
  }

  const result = await client.query(
    `UPDATE oms.products 
     SET tags = $1::jsonb, updated_by = $2
     WHERE product_id = $3 AND merchant_id = $4
     RETURNING *`,
    [JSON.stringify(tags), userId, productId, merchantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Product not found');
  }

  return result.rows[0];
}


import { Pool } from 'pg';
import { checkColumnExists } from '../utils/columnCheck';

// Get all tags from products
export async function getTagsQuery(
  pool: Pool,
  merchantId?: number
): Promise<{ query: string; params: any[] } | null> {
  // Check if tags column exists first
  const hasTags = await checkColumnExists(pool, 'oms', 'products', 'tags');
  
  if (!hasTags) {
    return null; // Column doesn't exist, return null to indicate empty result
  }

  let query = `
    SELECT DISTINCT tag, COUNT(*) as product_count
    FROM oms.products, jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) as tag
    WHERE is_active = true
  `;
  const params: any[] = [];

  if (merchantId) {
    query += ` AND merchant_id = $1`;
    params.push(merchantId);
  }

  query += ` GROUP BY tag ORDER BY tag ASC`;

  return { query, params };
}


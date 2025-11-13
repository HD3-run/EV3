import { Pool } from 'pg';
import { checkColumnExists } from '../utils/columnCheck';

export async function getCategoriesQuery(
  pool: Pool,
  merchantId: number
): Promise<{ query: string; params: any[] }> {
  // Check if is_active column exists
  const hasIsActive = await checkColumnExists(pool, 'oms', 'products', 'is_active');
  
  let query = `
    SELECT DISTINCT category as category_name, COUNT(*) as product_count
    FROM oms.products
    WHERE category IS NOT NULL AND category != ''
  `;
  const params: any[] = [];
  let paramIndex = 1;
  
  if (hasIsActive) {
    query += ` AND is_active = true`;
  }
  
  // Always filter by merchant_id
  query += ` AND merchant_id = $${paramIndex}`;
  params.push(merchantId);
  paramIndex++;
  
  query += ` GROUP BY category ORDER BY category ASC`;
  
  return { query, params };
}


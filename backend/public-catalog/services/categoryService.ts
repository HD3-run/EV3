import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import { getPublicCategoriesQuery } from '../queries/category-queries';
import { checkPublicCatalogSchema } from '../queries/schema-check-queries';

export interface CategoryServiceResult {
  success: boolean;
  categories?: Array<{
    category_id: string;
    category_name: string;
    product_count: number;
  }>;
  error?: string;
}

export async function getPublicCategories(
  pool: Pool,
  merchantId: number
): Promise<CategoryServiceResult> {
  try {
    // Check schema for is_active column
    const schemaChecks = await checkPublicCatalogSchema(pool);
    const query = getPublicCategoriesQuery(merchantId, schemaChecks.hasIsActive);
    
    const result = await pool.query(query.query, query.queryParams);

    return {
      success: true,
      categories: result.rows.map((row: any) => ({
        category_id: row.category_name,
        category_name: row.category_name,
        product_count: parseInt(row.product_count),
      })),
    };
  } catch (error) {
    logger.error('Error fetching public categories:', error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: 'Failed to fetch categories',
    };
  }
}


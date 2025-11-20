// Schema checking queries for public catalog

import { Pool } from 'pg';

/**
 * Check if catalog_products view exists
 */
export const checkCatalogViewQuery = (): { query: string; queryParams: any[] } => {
  const query = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_schema = 'oms' AND table_name = 'catalog_products'
    ) as exists
  `;
  
  return { query, queryParams: [] };
};

/**
 * Check if column exists in table
 */
export const checkColumnExistsQuery = (
  tableName: string,
  columnName: string
): { query: string; queryParams: any[] } => {
  const query = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'oms' AND table_name = $1 AND column_name = $2
  `;
  
  return { query, queryParams: [tableName, columnName] };
};

/**
 * Check all schema columns needed for public catalog
 */
export interface SchemaCheckResult {
  useView: boolean;
  hasIsActive: boolean;
  hasIsFeatured: boolean;
  hasReservedQuantity: boolean;
  hasProductSellingPrice: boolean;
}

export async function checkPublicCatalogSchema(pool: Pool): Promise<SchemaCheckResult> {
  const [viewCheck, isActiveCheck, isFeaturedCheck, reservedQtyCheck, productSellingPriceCheck] = await Promise.all([
    pool.query(checkCatalogViewQuery().query, checkCatalogViewQuery().queryParams),
    pool.query(
      checkColumnExistsQuery('products', 'is_active').query,
      checkColumnExistsQuery('products', 'is_active').queryParams
    ),
    pool.query(
      checkColumnExistsQuery('products', 'is_featured').query,
      checkColumnExistsQuery('products', 'is_featured').queryParams
    ),
    pool.query(
      checkColumnExistsQuery('inventory', 'reserved_quantity').query,
      checkColumnExistsQuery('inventory', 'reserved_quantity').queryParams
    ),
    pool.query(
      checkColumnExistsQuery('products', 'selling_price').query,
      checkColumnExistsQuery('products', 'selling_price').queryParams
    )
  ]);
  
  return {
    useView: viewCheck.rows[0]?.exists || false,
    hasIsActive: isActiveCheck.rows.length > 0,
    hasIsFeatured: isFeaturedCheck.rows.length > 0,
    hasReservedQuantity: reservedQtyCheck.rows.length > 0,
    hasProductSellingPrice: productSellingPriceCheck.rows.length > 0,
  };
}


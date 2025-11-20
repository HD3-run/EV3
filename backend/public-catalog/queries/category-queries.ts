// Category queries for public catalog

/**
 * Get categories for public catalog
 */
export const getPublicCategoriesQuery = (
  merchantId: number,
  hasIsActive: boolean
): { query: string; queryParams: any[] } => {
  let query = `
    SELECT DISTINCT category as category_name, COUNT(*) as product_count
    FROM oms.products
    WHERE category IS NOT NULL AND category != ''
      AND merchant_id = $1
  `;
  
  // Add status filter
  if (hasIsActive) {
    query += ` AND (status = 'active' OR is_active = true)`;
  } else {
    query += ` AND status = 'active'`;
  }
  
  query += ` GROUP BY category ORDER BY category ASC`;
  
  return { query, queryParams: [merchantId] };
};


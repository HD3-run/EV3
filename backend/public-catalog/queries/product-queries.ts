// Product queries for public catalog

import { SchemaCheckResult } from './schema-check-queries';

export interface ProductListFilters {
  merchantId: number;
  page: number;
  limit: number;
  category?: string;
  search?: string;
  is_featured?: string;
}

/**
 * Build product list query for public catalog
 */
export function buildPublicProductListQuery(
  schemaChecks: SchemaCheckResult,
  filters: ProductListFilters
): { query: string; params: any[]; countQuery: string; countParams: any[] } {
  const { useView, hasIsActive, hasIsFeatured, hasReservedQuantity, hasProductSellingPrice } = schemaChecks;
  const { merchantId, page, limit, category, search, is_featured } = filters;
  
  const offset = (page - 1) * limit;
  let query = '';
  
  if (useView) {
    query = `
      SELECT 
        cp.*,
        cp.category as category_name,
        cp.quantity_available as total_stock,
        cp.catalog_images as images,
        cp.primary_image_url,
        (SELECT is_featured FROM oms.product_catalogue 
         WHERE product_id = cp.product_id AND is_primary = true AND status = 'active' 
         LIMIT 1) as is_featured
      FROM oms.catalog_products cp
      WHERE cp.merchant_id = $1
    `;
    
    // Add status filter for view
    if (hasIsActive) {
      query += ` AND (cp.status = 'active' OR cp.is_active = true)`;
    } else {
      query += ` AND cp.status = 'active'`;
    }
  } else {
    const reservedQtySelect = hasReservedQuantity 
      ? 'COALESCE(i.reserved_quantity, 0) as reserved_quantity,'
      : '0 as reserved_quantity,';
    
    const sellingPriceSelect = hasProductSellingPrice
      ? 'COALESCE(p.selling_price, i.selling_price) as selling_price,'
      : 'i.selling_price as selling_price,';
    
    query = `
      SELECT 
        p.*,
        p.category as category_name,
        i.quantity_available,
        i.quantity_available as total_stock,
        i.reorder_level,
        i.cost_price,
        ${reservedQtySelect}
        ${sellingPriceSelect}
        (SELECT json_agg(
          json_build_object(
            'image_id', pc.catalogue_id,
            'catalogue_id', pc.catalogue_id,
            'image_url', pc.media_url,
            'media_url', pc.media_url,
            's3_key', pc.s3_key,
            'alt_text', pc.alt_text,
            'display_order', pc.display_order,
            'is_primary', pc.is_primary,
            'is_featured', pc.is_featured,
            'media_type', pc.media_type,
            'status', pc.status
          ) ORDER BY pc.is_primary DESC, pc.display_order ASC
        )
        FROM oms.product_catalogue pc
        WHERE pc.product_id = p.product_id AND pc.status = 'active') as images,
        (SELECT media_url FROM oms.product_catalogue 
         WHERE product_id = p.product_id AND status = 'active' 
         ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_image_url,
        (SELECT is_featured FROM oms.product_catalogue 
         WHERE product_id = p.product_id AND is_primary = true AND status = 'active' 
         LIMIT 1) as is_featured
      FROM oms.products p
      INNER JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = $1
    `;
    
    // Add status filter for manual join
    if (hasIsActive) {
      query += ` AND (p.status = 'active' OR p.is_active = true)`;
    } else {
      query += ` AND p.status = 'active'`;
    }
  }

  const params: any[] = [merchantId];
  let paramIndex = 2;
  const tablePrefix = useView ? 'cp' : 'p';

  // Add filters
  if (search) {
    query += ` AND (${tablePrefix}.product_name ILIKE $${paramIndex} OR ${tablePrefix}.description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (category) {
    query += ` AND ${tablePrefix}.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (is_featured === 'true' && (hasIsFeatured || useView)) {
    query += ` AND ${tablePrefix}.is_featured = true`;
  }

  // Build count query
  let countQuery = '';
  if (useView) {
    countQuery = `
      SELECT COUNT(*) as count
      FROM oms.catalog_products cp
      WHERE cp.merchant_id = $1
    `;
    if (hasIsActive) {
      countQuery += ` AND (cp.status = 'active' OR cp.is_active = true)`;
    } else {
      countQuery += ` AND cp.status = 'active'`;
    }
  } else {
    countQuery = `
      SELECT COUNT(*) as count
      FROM oms.products p
      INNER JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = $1
    `;
    if (hasIsActive) {
      countQuery += ` AND (p.status = 'active' OR p.is_active = true)`;
    } else {
      countQuery += ` AND p.status = 'active'`;
    }
  }
  
  // Add same filters to count query
  let countParams: any[] = [merchantId];
  let countParamIndex = 2;
  
  if (search) {
    const searchPrefix = useView ? 'cp' : 'p';
    countQuery += ` AND (${searchPrefix}.product_name ILIKE $${countParamIndex} OR ${searchPrefix}.description ILIKE $${countParamIndex})`;
    countParams.push(`%${search}%`);
    countParamIndex++;
  }
  
  if (category) {
    const catPrefix = useView ? 'cp' : 'p';
    countQuery += ` AND ${catPrefix}.category = $${countParamIndex}`;
    countParams.push(category);
    countParamIndex++;
  }
  
  if (is_featured === 'true' && (hasIsFeatured || useView)) {
    const featPrefix = useView ? 'cp' : 'p';
    countQuery += ` AND ${featPrefix}.is_featured = true`;
  }

  // Add pagination to main query
  query += ` ORDER BY ${tablePrefix}.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  return { query, params, countQuery, countParams };
}

/**
 * Build single product query for public catalog
 */
export function buildPublicSingleProductQuery(
  schemaChecks: SchemaCheckResult,
  productId: number,
  merchantId: number
): { query: string; params: any[] } {
  const { useView, hasReservedQuantity, hasProductSellingPrice } = schemaChecks;
  
  let query = '';
  if (useView) {
    query = `
      SELECT 
        cp.*,
        cp.category as category_name,
        cp.quantity_available as total_stock,
        cp.catalog_images as images,
        cp.primary_image_url,
        (SELECT is_featured FROM oms.product_catalogue 
         WHERE product_id = cp.product_id AND is_primary = true AND status = 'active' 
         LIMIT 1) as is_featured
      FROM oms.catalog_products cp
      WHERE cp.product_id = $1 AND cp.merchant_id = $2
        AND (cp.status = 'active' OR cp.is_active = true)
    `;
  } else {
    const reservedQtySelect = hasReservedQuantity 
      ? 'COALESCE(i.reserved_quantity, 0) as reserved_quantity,'
      : '0 as reserved_quantity,';
    
    const sellingPriceSelect = hasProductSellingPrice
      ? 'COALESCE(p.selling_price, i.selling_price) as selling_price,'
      : 'i.selling_price as selling_price,';
    
    query = `
      SELECT 
        p.*,
        p.category as category_name,
        i.quantity_available,
        i.quantity_available as total_stock,
        i.reorder_level,
        i.cost_price,
        ${reservedQtySelect}
        ${sellingPriceSelect}
        (SELECT json_agg(
          json_build_object(
            'image_id', pc.catalogue_id,
            'catalogue_id', pc.catalogue_id,
            'image_url', pc.media_url,
            'media_url', pc.media_url,
            's3_key', pc.s3_key,
            'alt_text', pc.alt_text,
            'display_order', pc.display_order,
            'is_primary', pc.is_primary,
            'is_featured', pc.is_featured,
            'media_type', pc.media_type,
            'status', pc.status
          ) ORDER BY pc.is_primary DESC, pc.display_order ASC
        )
        FROM oms.product_catalogue pc
        WHERE pc.product_id = p.product_id AND pc.status = 'active') as images,
        (SELECT media_url FROM oms.product_catalogue 
         WHERE product_id = p.product_id AND status = 'active' 
         ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_image_url,
        (SELECT is_featured FROM oms.product_catalogue 
         WHERE product_id = p.product_id AND is_primary = true AND status = 'active' 
         LIMIT 1) as is_featured
      FROM oms.products p
      INNER JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.product_id = $1 AND p.merchant_id = $2
        AND (p.status = 'active' OR p.is_active = true)
    `;
  }

  return { query, params: [productId, merchantId] };
}


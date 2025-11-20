import { Pool, PoolClient } from 'pg';
import { checkViewExists } from '../utils/columnCheck';

export interface ProductFilters {
  page: number;
  limit: number;
  category?: string;
  search?: string;
  is_featured?: string;
  is_active?: string;
}

export interface ColumnChecks {
  useView: boolean;
  hasIsActive: boolean;
  hasIsFeatured: boolean;
  hasReservedQuantity: boolean;
  hasProductSellingPrice: boolean;
}

// Check which columns/tables exist
export async function checkProductColumns(pool: Pool): Promise<ColumnChecks> {
  const [viewCheck, isActiveCheck, isFeaturedCheck, reservedQtyCheck, productSellingPriceCheck] = await Promise.all([
    checkViewExists(pool, 'oms', 'catalog_products'),
    pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' AND table_name = 'products' AND column_name = 'is_active'
    `),
    pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' AND table_name = 'products' AND column_name = 'is_featured'
    `),
    pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' AND table_name = 'inventory' AND column_name = 'reserved_quantity'
    `),
    pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' AND table_name = 'products' AND column_name = 'selling_price'
    `)
  ]);
  
  return {
    useView: viewCheck,
    hasIsActive: isActiveCheck.rows.length > 0,
    hasIsFeatured: isFeaturedCheck.rows.length > 0,
    hasReservedQuantity: reservedQtyCheck.rows.length > 0,
    hasProductSellingPrice: productSellingPriceCheck.rows.length > 0,
  };
}

// Build product listing query
export function buildProductListQuery(
  columnChecks: ColumnChecks,
  merchantId: number,
  filters: ProductFilters
): { query: string; params: any[]; countQuery: string; countParams: any[] } {
  const { useView, hasIsActive, hasIsFeatured, hasReservedQuantity, hasProductSellingPrice } = columnChecks;
  const { page, limit, category, search, is_featured, is_active } = filters;
  
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
      WHERE 1=1
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
      WHERE 1=1
    `;
  }

  const params: any[] = [];
  let paramIndex = 1;
  const tablePrefix = useView ? 'cp' : 'p';

  // Always filter by merchant_id
  query += ` AND ${tablePrefix}.merchant_id = $${paramIndex}`;
  params.push(merchantId);
  paramIndex++;

  // Only filter by is_active if column exists
  if (is_active !== 'all' && (hasIsActive || useView)) {
    query += ` AND ${tablePrefix}.is_active = $${paramIndex}`;
    params.push(is_active === 'true');
    paramIndex++;
  }

  // Handle both category (name) and category_id (which is actually the name)
  if (category) {
    query += ` AND ${tablePrefix}.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (is_featured === 'true' && (hasIsFeatured || useView)) {
    query += ` AND ${tablePrefix}.is_featured = true`;
  }

  if (search) {
    query += ` AND (${tablePrefix}.product_name ILIKE $${paramIndex} OR ${tablePrefix}.sku ILIKE $${paramIndex} OR ${tablePrefix}.description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Build count query before adding ORDER BY, LIMIT, OFFSET
  // Wrap the entire query in a subquery and count rows
  // This is more reliable than regex replacement when there are subqueries in SELECT
  const countQuery = `SELECT COUNT(*) FROM (${query}) as count_subquery`;
  
  // Count query uses same params (before adding LIMIT/OFFSET)
  const countParams = [...params];

  // Add pagination to main query
  query += ` ORDER BY ${tablePrefix}.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  return { query, params, countQuery, countParams };
}

// Build single product query
export async function buildSingleProductQuery(
  pool: Pool,
  productId: number,
  merchantId: number
): Promise<{ query: string; params: any[] }> {
  const [viewCheck, reservedQtyCheck, productSellingPriceCheck] = await Promise.all([
    checkViewExists(pool, 'oms', 'catalog_products'),
    pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' AND table_name = 'inventory' AND column_name = 'reserved_quantity'
    `),
    pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' AND table_name = 'products' AND column_name = 'selling_price'
    `)
  ]);
  
  const useView = viewCheck;
  const hasReservedQuantity = reservedQtyCheck.rows.length > 0;
  const hasProductSellingPrice = productSellingPriceCheck.rows.length > 0;
  
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
      WHERE cp.product_id = $1
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
      WHERE p.product_id = $1
    `;
  }
  
  const params: any[] = [productId];
  const tablePrefix = useView ? 'cp' : 'p';
  query += ` AND ${tablePrefix}.merchant_id = $2`;
  params.push(merchantId);

  return { query, params };
}

// Transform product data for frontend
export function transformProduct(product: any): any {
  // Transform tags if they exist
  let transformedTags: any[] = [];
  if (product.tags) {
    if (Array.isArray(product.tags)) {
      if (product.tags.length > 0 && typeof product.tags[0] === 'string') {
        transformedTags = product.tags.map((tag: string, index: number) => ({
          tag_id: index + 1,
          tag_name: tag,
        }));
      } else {
        transformedTags = product.tags;
      }
    }
  }
  
  // Transform images if they exist
  let transformedImages: any[] = [];
  if (product.images) {
    if (Array.isArray(product.images)) {
      transformedImages = product.images.map((img: any) => ({
        ...img,
        image_id: img.image_id || img.catalogue_id,
        image_url: img.image_url || img.media_url,
      }));
    }
  }
  
  // Map status to is_active
  const isActive = product.status === 'active' || product.is_active === true;
  
  return {
    ...product,
    tags: transformedTags,
    images: transformedImages,
    is_active: isActive,
  };
}

// Check for duplicate SKU
export async function checkDuplicateSku(
  client: PoolClient,
  merchantId: number,
  sku: string
): Promise<boolean> {
  const result = await client.query(
    'SELECT product_id FROM oms.products WHERE merchant_id = $1 AND sku = $2',
    [merchantId, sku]
  );
  return result.rows.length > 0;
}


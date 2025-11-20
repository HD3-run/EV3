import { PoolClient, Pool } from 'pg';
import { checkColumnsExist, checkViewExists } from '../utils/columnCheck';
import { checkDuplicateSku } from '../queries/product-queries';
import { createInventoryEntry, inventoryEntryExists, updateInventoryEntry } from './inventoryIntegrationService';
import { buildSingleProductQuery, transformProduct } from '../queries/product-queries';

export interface CreateProductData {
  product_name: string;
  sku?: string;
  description?: string;
  category?: string;
  brand?: string;
  hsn_code?: string;
  gst_rate?: number;
  quantity_available?: number;
  reorder_level?: number;
  cost_price?: number;
  selling_price?: number;
  unit_of_measure?: string;
  min_stock_level?: number;
  max_stock_level?: number;
  is_featured?: boolean | string | number;
  tags?: any[];
  catalog_metadata?: any;
}

export interface UpdateProductData {
  [key: string]: any;
}

// Create product service
export async function createProductService(
  pool: Pool,
  client: PoolClient,
  merchantId: number,
  userId: number | string,
  productData: CreateProductData
): Promise<any> {
  const {
    product_name,
    sku,
    description,
    category,
    brand,
    hsn_code,
    gst_rate = 18.00,
    quantity_available = 0,
    reorder_level = 0,
    cost_price,
    selling_price,
    unit_of_measure = 'piece',
    min_stock_level = 0,
    max_stock_level,
    is_featured = false,
    tags = [],
    catalog_metadata = {},
  } = productData;

  // Check for duplicate SKU only if provided
  if (sku) {
    const isDuplicate = await checkDuplicateSku(client, merchantId, sku);
    if (isDuplicate) {
      throw new Error('SKU already exists for this merchant');
    }
  }

  // Build insert query dynamically based on available columns
  const baseColumns = ['merchant_id', 'product_name', 'description', 'category', 'brand', 'hsn_code', 'gst_rate'];
  const baseValues = [merchantId, product_name, description || null, category || null, brand || null, hsn_code || null, gst_rate];
  
  // Check which catalog columns exist
  const columnCheckResult = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'oms' 
      AND table_name = 'products' 
      AND column_name IN ('selling_price', 'unit_of_measure', 'min_stock_level', 'max_stock_level', 'is_featured', 'tags', 'catalog_metadata', 'is_active', 'updated_by')
  `);
  
  const existingColumns = columnCheckResult.rows.map((row: any) => row.column_name);
  const catalogColumns: string[] = [];
  const catalogValues: any[] = [];
  
  if (existingColumns.includes('selling_price')) {
    catalogColumns.push('selling_price');
    catalogValues.push(selling_price || null);
  }
  
  if (existingColumns.includes('unit_of_measure')) {
    catalogColumns.push('unit_of_measure');
    catalogValues.push(unit_of_measure);
  }
  
  if (existingColumns.includes('min_stock_level')) {
    catalogColumns.push('min_stock_level');
    catalogValues.push(min_stock_level);
  }
  
  if (existingColumns.includes('max_stock_level')) {
    catalogColumns.push('max_stock_level');
    catalogValues.push(max_stock_level || null);
  }
  
  if (existingColumns.includes('is_featured')) {
    catalogColumns.push('is_featured');
    const featuredValue = (typeof is_featured === 'string' && is_featured === 'true') || is_featured === true || (typeof is_featured === 'number' && is_featured === 1);
    catalogValues.push(featuredValue);
  }
  
  if (existingColumns.includes('tags')) {
    catalogColumns.push('tags');
    catalogValues.push(JSON.stringify(tags));
  }
  
  if (existingColumns.includes('catalog_metadata')) {
    catalogColumns.push('catalog_metadata');
    catalogValues.push(JSON.stringify(catalog_metadata));
  }
  
  if (existingColumns.includes('is_active')) {
    catalogColumns.push('is_active');
    catalogValues.push(true);
  }
  
  if (existingColumns.includes('updated_by')) {
    catalogColumns.push('updated_by');
    catalogValues.push(userId);
  }
  
  const allColumns = [...baseColumns, ...catalogColumns];
  const allValues = [...baseValues, ...catalogValues];
  
  // Build placeholders with JSONB casting where needed
  const placeholders = allColumns.map((col, i) => {
    if (col === 'tags' || col === 'catalog_metadata') {
      return `$${i + 1}::jsonb`;
    }
    return `$${i + 1}`;
  }).join(', ');
  
  const insertQuery = `INSERT INTO oms.products (${allColumns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  
  const productResult = await client.query(insertQuery, allValues);
  const product = productResult.rows[0];
  const productId = product.product_id;
  const finalSku = product.sku || sku;

  // Create or update inventory entry
  const inventoryExists = await inventoryEntryExists(client, productId, merchantId);
  if (!inventoryExists) {
    await createInventoryEntry(client, merchantId, productId, finalSku, {
      quantity_available,
      reorder_level,
      cost_price,
      selling_price,
    });
  } else {
    await updateInventoryEntry(client, productId, merchantId, {
      quantity_available,
      reorder_level,
      cost_price,
      selling_price,
    });
  }

  // Fetch complete product with inventory data
  const { query, params } = await buildSingleProductQuery(pool, productId, merchantId);
  const finalResult = await client.query(query, params);
  
  if (finalResult.rows.length === 0) {
    return product; // Fallback to basic product if join fails
  }
  
  return transformProduct(finalResult.rows[0]);
}

// Update product service
export async function updateProductService(
  pool: Pool,
  client: PoolClient,
  productId: number,
  merchantId: number,
  userId: number | string,
  updateData: UpdateProductData
): Promise<any> {
  // Extract inventory fields before processing
  const quantityAvailable = updateData.quantity_available;
  const reorderLevel = updateData.reorder_level;
  const costPrice = updateData.cost_price;
  const sellingPrice = updateData.selling_price;
  const isFeatured = updateData.is_featured;
  
  // Remove fields that shouldn't be updated
  delete updateData.product_id;
  delete updateData.merchant_id;
  delete updateData.created_at;
  delete updateData.created_by;
  delete updateData.base_price;
  delete updateData.total_stock;
  delete updateData.cost_price;
  delete updateData.quantity_available;
  delete updateData.reorder_level;
  delete updateData.selling_price;
  delete updateData.is_featured;
  delete updateData.images;
  delete updateData.catalog_images;
  delete updateData.primary_image_url;
  
  // Map category_id to category
  if (updateData.category_id !== undefined) {
    if (updateData.category_id && updateData.category_id.trim() !== '') {
      updateData.category = updateData.category_id;
    } else {
      updateData.category = null;
    }
    delete updateData.category_id;
  }
  
  // Map tax_rate to gst_rate
  if (updateData.tax_rate !== undefined) {
    updateData.gst_rate = updateData.tax_rate;
    delete updateData.tax_rate;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No fields to update');
  }

  // Process fields
  const processedFields: any = {};
  const numericFields = ['selling_price', 'min_stock_level', 'max_stock_level'];
  const booleanFields = ['is_featured', 'is_active'];
  const jsonbFields = ['tags', 'catalog_metadata'];

  for (const [key, value] of Object.entries(updateData)) {
    if (booleanFields.includes(key)) {
      processedFields[key] = value === 'true' || value === true || value === 1;
      continue;
    }
    
    if (value === '' || (value === null && !numericFields.includes(key))) {
      if (numericFields.includes(key)) {
        continue;
      }
      processedFields[key] = null;
    } else if (numericFields.includes(key)) {
      const numValue = parseFloat(value as string);
      if (!isNaN(numValue)) {
        processedFields[key] = numValue;
      }
    } else if (jsonbFields.includes(key)) {
      processedFields[key] = typeof value === 'string' ? value : JSON.stringify(value);
    } else {
      processedFields[key] = value;
    }
  }

  if (Object.keys(processedFields).length === 0) {
    throw new Error('No valid fields to update');
  }

  // Check which columns actually exist
  const columnCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'oms' 
      AND table_name = 'products'
  `);
  
  const existingColumns = columnCheck.rows.map((row: any) => row.column_name);
  
  // Filter out fields that don't exist
  const validFields: any = {};
  for (const [key, value] of Object.entries(processedFields)) {
    if (existingColumns.includes(key)) {
      validFields[key] = value;
    }
  }
  
  if (Object.keys(validFields).length === 0) {
    throw new Error('No valid fields to update');
  }

  // Build dynamic update query
  const setClause: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(validFields)) {
    if (jsonbFields.includes(key)) {
      setClause.push(`${key} = $${paramIndex}::jsonb`);
    } else {
      setClause.push(`${key} = $${paramIndex}`);
    }
    values.push(value);
    paramIndex++;
  }
  
  if (existingColumns.includes('updated_by')) {
    setClause.push(`updated_by = $${paramIndex}`);
    values.push(userId);
    paramIndex++;
  }

  values.push(productId, merchantId);

  const updateQuery = `UPDATE oms.products 
     SET ${setClause.join(', ')}
     WHERE product_id = $${paramIndex} AND merchant_id = $${paramIndex + 1}
     RETURNING *`;
  
  const result = await client.query(updateQuery, values);

  if (result.rows.length === 0) {
    throw new Error('Product not found');
  }

  // Update inventory if needed
  if (quantityAvailable !== undefined || reorderLevel !== undefined || costPrice !== undefined || sellingPrice !== undefined) {
    await updateInventoryEntry(client, productId, merchantId, {
      quantity_available: quantityAvailable,
      reorder_level: reorderLevel,
      cost_price: costPrice,
      selling_price: sellingPrice,
    });
  }
  
  // Update product_catalogue for is_featured if provided
  if (isFeatured !== undefined) {
    const featuredValue = isFeatured === 'true' || isFeatured === true || isFeatured === 1;
    await client.query(
      `UPDATE oms.product_catalogue 
       SET is_featured = $1
       WHERE product_id = $2 AND is_primary = true`,
      [featuredValue, productId]
    );
  }

  return result.rows[0];
}

// Delete product service (soft delete)
export async function deleteProductService(
  client: PoolClient,
  productId: number,
  merchantId: number,
  userId: number | string
): Promise<void> {
  const result = await client.query(
    `UPDATE oms.products 
     SET is_active = false, updated_by = $3
     WHERE product_id = $1 AND merchant_id = $2
     RETURNING *`,
    [productId, merchantId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Product not found');
  }
}


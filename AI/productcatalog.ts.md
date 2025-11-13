import { Router, Request, Response } from 'express';
import { pool } from './db';
import multer from 'multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME, generateS3Key, validateImageFile } from './utils/s3-config';
import { deleteImageFromS3 } from './utils/s3-config';
import { authenticateUser } from './middleware/auth';
import { createReadStream, unlinkSync } from 'fs';
import { tmpdir } from 'os';

const router = Router();

// Configure multer with disk storage (streams to disk, then to S3 - avoids loading entire file into RAM)
// This is much safer for large files and parallel uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Use system temp directory
      cb(null, tmpdir());
    },
    filename: (req, file, cb) => {
      // Generate temp filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `product-${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP are allowed.'));
    }
  },
});

// Helper function to upload file from disk to S3 (streams directly, no memory buffer)
async function uploadFileToS3(
  filePath: string,
  originalName: string,
  mimetype: string,
  productId?: number
): Promise<{ success: boolean; s3Key?: string; imageUrl?: string; error?: string }> {
  try {
    // Validate file
    const validation = validateImageFile(mimetype, 0); // Size already validated by multer
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate S3 key
    const s3Key = generateS3Key(originalName, productId);
    
    // Stream file from disk directly to S3 (no memory buffer)
    const fileStream = createReadStream(filePath);
    
    // Upload to S3 using stream
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: mimetype,
      Metadata: {
        originalName: originalName,
        uploadedAt: new Date().toISOString(),
        productId: productId?.toString() || 'unknown',
      },
    });

    await s3Client.send(command);

    // Generate image URL
    const region = process.env.AWS_REGION || 'ap-south-1';
    const imageUrl = `https://${S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${s3Key}`;

    // Clean up temp file
    try {
      unlinkSync(filePath);
    } catch (unlinkError) {
      console.warn('Failed to delete temp file:', unlinkError);
    }

    return {
      success: true,
      s3Key,
      imageUrl,
    };
  } catch (error) {
    // Clean up temp file on error
    try {
      unlinkSync(filePath);
    } catch (unlinkError) {
      console.warn('Failed to delete temp file after error:', unlinkError);
    }
    
    console.error('Error uploading to S3:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    };
  }
}

// Get categories from products (using distinct category values)
router.get('/categories', async (req: Request, res: Response) => {
  try {
    // Get merchant_id from session if authenticated
    const merchantId = (req as any).user?.merchant_id || (req as any).session?.merchant_id;
    
    // Require merchant_id to filter categories properly
    if (!merchantId) {
      return res.status(401).json({
        success: false,
        error: 'Merchant ID not found. Please log in.',
      });
    }
    
    // Check if is_active column exists
    const isActiveCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' AND table_name = 'products' AND column_name = 'is_active'
    `);
    const hasIsActive = isActiveCheck.rows.length > 0;
    
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
    
    // Always filter by merchant_id (required above)
    query += ` AND merchant_id = $${paramIndex}`;
    params.push(merchantId);
    paramIndex++;
    
    query += ` GROUP BY category ORDER BY category ASC`;
    
    const result = await pool.query(query, params);

    res.json({
      success: true,
      categories: result.rows.map((row: any) => ({
        category_id: row.category_name, // Use category_name as ID (it's the actual category string)
        category_name: row.category_name,
        product_count: parseInt(row.product_count),
      })),
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
});

// Get all products with pagination and filters
router.get('/products', async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '20',
    category,
    search,
    is_featured,
    is_active = 'true',
  } = req.query;

  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  const merchantId = (req as any).user?.merchant_id || (req as any).session?.merchant_id;
  
  // Require merchant_id to prevent showing all products
  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found. Please log in.',
    });
  }

  try {
    // Check which columns/tables exist (one-time check)
    const [viewCheck, isActiveCheck, isFeaturedCheck, reservedQtyCheck, productSellingPriceCheck] = await Promise.all([
      pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.views 
          WHERE table_schema = 'oms' AND table_name = 'catalog_products'
        ) as exists
      `),
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
    
    const useView = viewCheck.rows[0]?.exists || false;
    const hasIsActive = isActiveCheck.rows.length > 0;
    const hasIsFeatured = isFeaturedCheck.rows.length > 0;
    const hasReservedQuantity = reservedQtyCheck.rows.length > 0;
    const hasProductSellingPrice = productSellingPriceCheck.rows.length > 0;
    
    // Try to use catalog_products view, fallback to manual join if view doesn't exist
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
      // Build reserved_quantity column conditionally
      const reservedQtySelect = hasReservedQuantity 
        ? 'COALESCE(i.reserved_quantity, 0) as reserved_quantity,'
        : '0 as reserved_quantity,';
      
      // Build selling_price column conditionally
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

    // Always filter by merchant_id (required above)
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
    const categoryFilter = (req.query.category as string) || (req.query.category_id as string);
    if (categoryFilter) {
      query += ` AND ${tablePrefix}.category = $${paramIndex}`;
      params.push(categoryFilter);
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

    // Get total count
    const countQuery = query.replace(/SELECT[\s\S]*FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY ${tablePrefix}.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), offset);

    const result = await pool.query(query, params);

    // Transform products: convert tags from JSONB array of strings to array of objects
    const transformedProducts = result.rows.map((product: any) => {
      // Transform tags if they exist
      let transformedTags: any[] = [];
      if (product.tags) {
        if (Array.isArray(product.tags)) {
          // If tags is already an array, check if it's strings or objects
          if (product.tags.length > 0 && typeof product.tags[0] === 'string') {
            // Transform array of strings to array of objects
            transformedTags = product.tags.map((tag: string, index: number) => ({
              tag_id: index + 1,
              tag_name: tag,
            }));
          } else {
            // Already objects, use as is
            transformedTags = product.tags;
          }
        }
      }
      
      // Transform images if they exist (ensure image_id and image_url are present)
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
      
      // Map status to is_active (database has 'status' string, frontend expects 'is_active' boolean)
      const isActive = product.status === 'active' || product.is_active === true;
      
      return {
        ...product,
        tags: transformedTags,
        images: transformedImages,
        is_active: isActive, // Map status to is_active for frontend
      };
    });

    res.json({
      success: true,
      products: transformedProducts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
    });
  }
});

// Get single product by ID
router.get('/products/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const productId = parseInt(id);
  const merchantId = (req as any).user?.merchant_id || (req as any).session?.merchant_id;
  
  if (isNaN(productId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid product ID',
    });
  }

  try {
    // Check if view exists and reserved_quantity column exists
    const [viewCheck, reservedQtyCheck, productSellingPriceCheck] = await Promise.all([
      pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.views 
          WHERE table_schema = 'oms' AND table_name = 'catalog_products'
        ) as exists
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
    const useView = viewCheck.rows[0]?.exists || false;
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
      
      // Build selling_price column conditionally
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

    // Always filter by merchant_id (required for security)
    if (!merchantId) {
      return res.status(401).json({
        success: false,
        error: 'Merchant ID not found. Please log in.',
      });
    }
    
    const tablePrefix = useView ? 'cp' : 'p';
    query += ` AND ${tablePrefix}.merchant_id = $2`;
    params.push(merchantId);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const product = result.rows[0];
    
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
    
    // Transform images if they exist (ensure image_id and image_url are present)
    let transformedImages: any[] = [];
    if (product.images || product.catalog_images) {
      const images = product.images || product.catalog_images;
      if (Array.isArray(images)) {
        transformedImages = images.map((img: any) => ({
          ...img,
          image_id: img.image_id || img.catalogue_id,
          image_url: img.image_url || img.media_url,
        }));
      }
    }

    // Map status to is_active (database has 'status' string, frontend expects 'is_active' boolean)
    const isActive = product.status === 'active' || product.is_active === true;
    
    res.json({
      success: true,
      product: {
        ...product,
        tags: transformedTags,
        images: transformedImages,
        is_active: isActive, // Map status to is_active for frontend
      },
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
    });
  }
});

// Create new product (automatically creates in products and inventory)
router.post('/products', authenticateUser, async (req: Request, res: Response) => {
  const {
    product_name,
    sku,
    description,
    category,
    brand,
    hsn_code,
    gst_rate,
    // Inventory fields
    quantity_available = 0,
    reorder_level = 0,
    cost_price,
    selling_price, // from inventory or products
    // Catalog-specific fields
    unit_of_measure = 'piece',
    min_stock_level = 0,
    max_stock_level,
    is_featured = false,
    tags = [],
    catalog_metadata = {},
  } = req.body;

  const merchantId = (req as any).user?.merchant_id;
  const userId = (req as any).user?.user_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  // Validation - SKU is optional, DB will auto-generate if not provided
  if (!product_name) {
    return res.status(400).json({
      success: false,
      error: 'Product name is required',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check for duplicate SKU only if provided (DB auto-generates if not provided)
    if (sku) {
      const existingSku = await client.query(
        'SELECT product_id FROM oms.products WHERE merchant_id = $1 AND sku = $2',
        [merchantId, sku]
      );

      if (existingSku.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: 'SKU already exists for this merchant',
        });
      }
    }

    // Create product in oms.products
    // Build insert query dynamically based on available columns
    // SKU is optional - database will auto-generate if not provided
    const baseColumns = ['merchant_id', 'product_name', 'description', 'category', 'brand', 'hsn_code', 'gst_rate'];
    const baseValues = [merchantId, product_name, description || null, category || null, brand || null, hsn_code || null, gst_rate || 18.00];
  
    
    // Check which catalog columns exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' 
        AND table_name = 'products' 
        AND column_name IN ('selling_price', 'unit_of_measure', 'min_stock_level', 'max_stock_level', 'is_featured', 'tags', 'catalog_metadata', 'is_active', 'updated_by')
    `);
    
    const existingColumns = columnCheck.rows.map((row: any) => row.column_name);
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
      // Ensure boolean value - handle both string and boolean
      const featuredValue = is_featured === 'true' || is_featured === true || is_featured === 1;
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
    
    // Note: is_active might not exist in manually created tables
    // We'll only add it if column exists
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
    // Get SKU from the product result (either user-provided or auto-generated by DB)
    const finalSku = product.sku || sku;

    // Check if inventory entry already exists (shouldn't happen, but just in case)
    const inventoryCheck = await client.query(
      'SELECT inventory_id FROM oms.inventory WHERE product_id = $1 AND merchant_id = $2',
      [productId, merchantId]
    );

    if (inventoryCheck.rows.length === 0) {
      // Create inventory entry
      // Check which columns exist in inventory table
      const inventoryColumnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'oms' 
          AND table_name = 'inventory' 
          AND column_name IN ('reserved_quantity', 'selling_price')
      `);
      
      const inventoryExistingColumns = inventoryColumnCheck.rows.map((row: any) => row.column_name);
      const inventoryColumns = ['merchant_id', 'product_id', 'sku', 'quantity_available', 'reorder_level', 'cost_price'];
      const inventoryValues = [merchantId, productId, finalSku, quantity_available, reorder_level, cost_price || null];
      
      if (inventoryExistingColumns.includes('selling_price')) {
        inventoryColumns.push('selling_price');
        inventoryValues.push(selling_price || null);
      }
      
      if (inventoryExistingColumns.includes('reserved_quantity')) {
        inventoryColumns.push('reserved_quantity');
        inventoryValues.push(0);
      }
      
      const inventoryPlaceholders = inventoryValues.map((_, i) => `$${i + 1}`).join(', ');
      
      await client.query(
        `INSERT INTO oms.inventory (${inventoryColumns.join(', ')}) VALUES (${inventoryPlaceholders})`,
        inventoryValues
      );
    } else {
      // Update existing inventory if needed
      if (cost_price !== undefined || selling_price !== undefined || quantity_available !== 0) {
        const updateFields: string[] = [];
        const values: any[] = [productId, merchantId];
        let paramIndex = 3;

        if (cost_price !== undefined) {
          updateFields.push(`cost_price = $${paramIndex}`);
          values.push(cost_price);
          paramIndex++;
        }

        if (selling_price !== undefined) {
          updateFields.push(`selling_price = $${paramIndex}`);
          values.push(selling_price);
          paramIndex++;
        }

        if (quantity_available !== 0) {
          updateFields.push(`quantity_available = $${paramIndex}`);
          values.push(quantity_available);
          paramIndex++;
        }

        if (reorder_level !== 0) {
          updateFields.push(`reorder_level = $${paramIndex}`);
          values.push(reorder_level);
          paramIndex++;
        }

        if (updateFields.length > 0) {
          await client.query(
            `UPDATE oms.inventory 
             SET ${updateFields.join(', ')}
             WHERE product_id = $1 AND merchant_id = $2`,
            values
          );
        }
      }
    }

    await client.query('COMMIT');

    // Fetch the complete product with inventory data
    // Check if view exists, otherwise use manual join
    const viewCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'oms' AND table_name = 'catalog_products'
      ) as exists
    `);
    const useView = viewCheck.rows[0]?.exists || false;
    
    let finalProduct;
    if (useView) {
      const viewResult = await client.query(
        'SELECT * FROM oms.catalog_products WHERE product_id = $1',
        [productId]
      );
      finalProduct = viewResult.rows[0];
    } else {
      // Check if reserved_quantity exists in inventory
      const reservedQtyCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'oms' AND table_name = 'inventory' AND column_name = 'reserved_quantity'
      `);
      const hasReservedQuantity = reservedQtyCheck.rows.length > 0;
      
      const reservedQtySelect = hasReservedQuantity 
        ? 'COALESCE(i.reserved_quantity, 0) as reserved_quantity,'
        : '0 as reserved_quantity,';
      
      // View doesn't exist, fetch manually with join
      const manualResult = await client.query(
        `SELECT 
          p.*,
          i.quantity_available,
          i.reorder_level,
          i.cost_price,
          ${reservedQtySelect}
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
          WHERE pc.product_id = p.product_id AND pc.status = 'active') as catalog_images,
          (SELECT media_url FROM oms.product_catalogue 
           WHERE product_id = p.product_id AND status = 'active' 
           ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_image_url,
          (SELECT is_featured FROM oms.product_catalogue 
           WHERE product_id = p.product_id AND is_primary = true AND status = 'active' 
           LIMIT 1) as is_featured
        FROM oms.products p
        INNER JOIN oms.inventory i ON p.product_id = i.product_id
        WHERE p.product_id = $1`,
        [productId]
      );
      finalProduct = manualResult.rows[0];
    }
    
    // is_featured is stored in product_catalogue table when image is uploaded
    // Frontend will pass is_featured when uploading the image

    res.status(201).json({
      success: true,
      product: finalProduct || product,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating product:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Product SKU already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create product',
    });
  } finally {
    client.release();
  }
});

// Update product catalog data
router.put('/products/:id', authenticateUser, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateFields = req.body;
  const merchantId = (req as any).user?.merchant_id;
  const userId = (req as any).user?.user_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  // Remove fields that shouldn't be updated
  delete updateFields.product_id;
  delete updateFields.merchant_id;
  delete updateFields.created_at;
  delete updateFields.created_by;
  
  // Save inventory fields before removing them (they need to be updated in inventory table)
  const quantityAvailable = updateFields.quantity_available;
  const reorderLevel = updateFields.reorder_level;
  const costPrice = updateFields.cost_price;
  const sellingPrice = updateFields.selling_price; // Extract selling_price for inventory update
  
  // Save is_featured before removing it (it goes to product_catalogue, not products)
  const isFeatured = updateFields.is_featured;
  
  // Remove fields that don't exist in products table
  // base_price doesn't exist (only selling_price exists)
  delete updateFields.base_price;
  // total_stock is computed, not stored
  delete updateFields.total_stock;
  // cost_price is in inventory table, not products table
  delete updateFields.cost_price;
  // quantity_available is in inventory table
  delete updateFields.quantity_available;
  // reorder_level is in inventory table
  delete updateFields.reorder_level;
  // selling_price is in inventory table, not products table
  delete updateFields.selling_price;
  // is_featured is in product_catalogue table, not products table
  delete updateFields.is_featured;
  // images is in product_catalogue table
  delete updateFields.images;
  delete updateFields.catalog_images;
  delete updateFields.primary_image_url;
  
  // Map category_id to category (form sends category_id but DB column is category)
  if (updateFields.category_id !== undefined) {
    // Only set category if a value is provided (not empty string)
    if (updateFields.category_id && updateFields.category_id.trim() !== '') {
      updateFields.category = updateFields.category_id;
    } else {
      // If empty/blank, set to null
      updateFields.category = null;
    }
    delete updateFields.category_id;
  }
  
  // Map tax_rate to gst_rate if tax_rate is provided
  if (updateFields.tax_rate !== undefined) {
    updateFields.gst_rate = updateFields.tax_rate;
    delete updateFields.tax_rate;
  }

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No fields to update',
    });
  }

  try {
    const processedFields: any = {};
    const numericFields = ['selling_price', 'min_stock_level', 'max_stock_level'];
    const booleanFields = ['is_featured', 'is_active'];
    const jsonbFields = ['tags', 'catalog_metadata'];

    for (const [key, value] of Object.entries(updateFields)) {
      // Handle boolean fields first - always process them, even if false
      if (booleanFields.includes(key)) {
        const boolValue = value === 'true' || value === true || value === 1;
        processedFields[key] = boolValue;
        if (key === 'is_featured') {
          console.log('🔍 PUT: Processing is_featured:', {
            original: value,
            type: typeof value,
            converted: boolValue,
            willBeUpdated: boolValue
          });
        }
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
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
    }

    // Check which columns actually exist in products table before updating
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' 
        AND table_name = 'products'
    `);
    
    const existingColumns = columnCheck.rows.map((row: any) => row.column_name);
    
    // Debug: Check if is_featured column exists
    const hasIsFeaturedColumn = existingColumns.includes('is_featured');
    console.log('🔍 PUT: Column check:', {
      hasIsFeaturedColumn,
      allColumns: existingColumns,
      processedFieldsKeys: Object.keys(processedFields),
      is_featuredInProcessed: 'is_featured' in processedFields,
      is_featuredValue: processedFields.is_featured
    });
    
    // Filter out fields that don't exist in the products table
    const validFields: any = {};
    for (const [key, value] of Object.entries(processedFields)) {
      if (existingColumns.includes(key)) {
        validFields[key] = value;
      } else {
        console.log(`⚠️ PUT: Column ${key} does not exist in products table, skipping`);
      }
    }
    
    // Debug: Check if is_featured made it to validFields
    if ('is_featured' in processedFields) {
      console.log('🔍 PUT: is_featured in validFields?', {
        inValidFields: 'is_featured' in validFields,
        validFieldsKeys: Object.keys(validFields),
        validFieldsIsFeatured: validFields.is_featured
      });
    }
    
    if (Object.keys(validFields).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
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
      
      if (key === 'is_featured') {
        console.log(`🔍 PUT: Adding is_featured to UPDATE query: ${key} = $${paramIndex} with value:`, value);
      }
      
      paramIndex++;
    }
    
    console.log('🔍 PUT: Final UPDATE query will be:', {
      setClause: setClause.join(', '),
      values: values,
      paramCount: values.length
    });

    // Only add updated_by if column exists
    if (existingColumns.includes('updated_by')) {
      setClause.push(`updated_by = $${paramIndex}`);
      values.push(userId);
      paramIndex++;
    }

    values.push(parseInt(id), merchantId);

    const updateQuery = `UPDATE oms.products 
       SET ${setClause.join(', ')}
       WHERE product_id = $${paramIndex} AND merchant_id = $${paramIndex + 1}
       RETURNING *`;
    
    console.log('🔍 PUT: Executing UPDATE query:', updateQuery);
    console.log('🔍 PUT: With values:', values);
    
    const result = await pool.query(updateQuery, values);
    
    console.log('🔍 PUT: UPDATE result:', {
      rowsAffected: result.rowCount,
      returnedProduct: result.rows[0] ? {
        product_id: result.rows[0].product_id,
        is_featured: result.rows[0].is_featured
      } : null
    });

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Update inventory table if inventory fields are provided
    if (quantityAvailable !== undefined || reorderLevel !== undefined || costPrice !== undefined || sellingPrice !== undefined) {
      const inventoryUpdates: string[] = [];
      const inventoryValues: any[] = [];
      let invParamIndex = 1;

      if (quantityAvailable !== undefined) {
        inventoryUpdates.push(`quantity_available = $${invParamIndex}`);
        inventoryValues.push(parseInt(quantityAvailable) || 0);
        invParamIndex++;
      }

      if (reorderLevel !== undefined) {
        inventoryUpdates.push(`reorder_level = $${invParamIndex}`);
        inventoryValues.push(parseInt(reorderLevel) || 0);
        invParamIndex++;
      }

      if (costPrice !== undefined) {
        inventoryUpdates.push(`cost_price = $${invParamIndex}`);
        inventoryValues.push(parseFloat(costPrice) || null);
        invParamIndex++;
      }

      if (sellingPrice !== undefined) {
        inventoryUpdates.push(`selling_price = $${invParamIndex}`);
        inventoryValues.push(parseFloat(sellingPrice) || null);
        invParamIndex++;
      }

      if (inventoryUpdates.length > 0) {
        inventoryValues.push(parseInt(id), merchantId);
        await pool.query(
          `UPDATE oms.inventory 
           SET ${inventoryUpdates.join(', ')}
           WHERE product_id = $${invParamIndex} AND merchant_id = $${invParamIndex + 1}`,
          inventoryValues
        );
        console.log('✅ PUT: Updated inventory fields:', inventoryUpdates.join(', '));
      }
    }
    
    // Update product_catalogue table for is_featured (if provided)
    if (isFeatured !== undefined) {
      const featuredValue = isFeatured === 'true' || isFeatured === true || isFeatured === 1;
      // Update the primary image's is_featured status
      const updateResult = await pool.query(
        `UPDATE oms.product_catalogue 
         SET is_featured = $1
         WHERE product_id = $2 AND is_primary = true`,
        [featuredValue, parseInt(id)]
      );
      console.log('🔍 PUT: Updated product_catalogue.is_featured:', {
        productId: parseInt(id),
        is_featured: featuredValue,
        rowsAffected: updateResult.rowCount
      });
    }

    res.json({
      success: true,
      product: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
    });
  }
});

// Delete product (soft delete)
router.delete('/products/:id', authenticateUser, async (req: Request, res: Response) => {
  const { id } = req.params;
  const merchantId = (req as any).user?.merchant_id;
  const userId = (req as any).user?.user_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  try {
    const result = await pool.query(
      `UPDATE oms.products 
       SET is_active = false, updated_by = $3
       WHERE product_id = $1 AND merchant_id = $2
       RETURNING *`,
      [id, merchantId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.json({
      success: true,
      message: 'Product deactivated successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
    });
  }
});

// Upload product image to oms.product_catalogue
router.post('/products/:id/images', authenticateUser, upload.single('image'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_primary = 'false', is_featured = 'false', alt_text, display_order = '0', media_type = 'image' } = req.body;
  const merchantId = (req as any).user?.merchant_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image file provided',
    });
  }

  const client = await pool.connect();

  try {
    // Check if product exists and belongs to merchant
    const productCheck = await client.query(
      'SELECT product_id FROM oms.products WHERE product_id = $1 AND merchant_id = $2',
      [parseInt(id), merchantId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found or does not belong to your merchant account',
      });
    }

    // Upload file from disk to S3 (streams directly, no memory buffer)
    const uploadResult = await uploadFileToS3(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      parseInt(id)
    );

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: uploadResult.error || 'Failed to upload image to S3',
      });
    }

    const { s3Key, imageUrl } = uploadResult;

    await client.query('BEGIN');

    // Get is_featured from request body (sent from frontend)
    const shouldBeFeatured = is_featured === 'true' || is_featured === true || is_featured === 1 || is_featured === '1';
    
    // If this is primary, unset other primary images
    if (is_primary === 'true') {
      await client.query(
        'UPDATE oms.product_catalogue SET is_primary = false WHERE product_id = $1',
        [id]
      );
    }

    // Insert image record into oms.product_catalogue
    const result = await client.query(
      `INSERT INTO oms.product_catalogue 
       (product_id, s3_key, media_url, media_type, is_primary, is_featured, display_order, alt_text, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING *`,
      [
        id,
        s3Key,
        imageUrl,
        media_type,
        is_primary === 'true',
        shouldBeFeatured,
        parseInt(display_order),
        alt_text || null,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      image: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading product image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload product image',
    });
  } finally {
    client.release();
  }
});

// Delete product image from oms.product_catalogue
router.delete('/products/:productId/images/:catalogueId', authenticateUser, async (req: Request, res: Response) => {
  const { productId, catalogueId } = req.params;
  const merchantId = (req as any).user?.merchant_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  const client = await pool.connect();

  try {
    // Verify product belongs to merchant
    const productCheck = await client.query(
      'SELECT product_id FROM oms.products WHERE product_id = $1 AND merchant_id = $2',
      [productId, merchantId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found or does not belong to your merchant account',
      });
    }

    // Get image details including s3_key
    const imageResult = await client.query(
      'SELECT s3_key FROM oms.product_catalogue WHERE catalogue_id = $1 AND product_id = $2',
      [catalogueId, productId]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Image not found',
      });
    }

    const s3Key = imageResult.rows[0].s3_key;

    await client.query('BEGIN');

    // Check if the image being deleted is primary
    const imageCheck = await client.query(
      'SELECT is_primary FROM oms.product_catalogue WHERE catalogue_id = $1 AND product_id = $2',
      [catalogueId, productId]
    );

    const wasPrimary = imageCheck.rows.length > 0 && imageCheck.rows[0].is_primary;

    // Delete from database
    await client.query(
      'DELETE FROM oms.product_catalogue WHERE catalogue_id = $1',
      [catalogueId]
    );

    // If the deleted image was primary, set another image as primary (first available image)
    if (wasPrimary) {
      const remainingImages = await client.query(
        `SELECT catalogue_id FROM oms.product_catalogue 
         WHERE product_id = $1 AND status = 'active' 
         ORDER BY display_order ASC, catalogue_id ASC 
         LIMIT 1`,
        [productId]
      );

      if (remainingImages.rows.length > 0) {
        await client.query(
          'UPDATE oms.product_catalogue SET is_primary = true WHERE catalogue_id = $1',
          [remainingImages.rows[0].catalogue_id]
        );
        console.log('✅ Auto-set new primary image after deletion:', remainingImages.rows[0].catalogue_id);
      }
    }

    // Delete from S3
    await deleteImageFromS3(s3Key);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting product image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product image',
    });
  } finally {
    client.release();
  }
});

// Set image as primary
router.put('/products/:productId/images/:catalogueId/set-primary', authenticateUser, async (req: Request, res: Response) => {
  const { productId, catalogueId } = req.params;
  const merchantId = (req as any).user?.merchant_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  const client = await pool.connect();

  try {
    // Verify product belongs to merchant
    const productCheck = await client.query(
      'SELECT product_id FROM oms.products WHERE product_id = $1 AND merchant_id = $2',
      [parseInt(productId), merchantId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Verify image exists and belongs to product
    const imageCheck = await client.query(
      'SELECT catalogue_id FROM oms.product_catalogue WHERE catalogue_id = $1 AND product_id = $2 AND status = $3',
      [parseInt(catalogueId), parseInt(productId), 'active']
    );

    if (imageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Image not found',
      });
    }

    await client.query('BEGIN');

    // Unset all other primary images
    await client.query(
      'UPDATE oms.product_catalogue SET is_primary = false WHERE product_id = $1',
      [parseInt(productId)]
    );

    // Set this image as primary
    await client.query(
      'UPDATE oms.product_catalogue SET is_primary = true WHERE catalogue_id = $1',
      [parseInt(catalogueId)]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Image set as primary successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error setting primary image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set primary image',
    });
  } finally {
    client.release();
  }
});

// Get all tags (from products.tags JSONB array)
router.get('/tags', async (req: Request, res: Response) => {
  const merchantId = (req as any).user?.merchant_id || (req as any).session?.merchant_id;

  try {
    // Check if tags column exists first
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'oms' 
        AND table_name = 'products' 
        AND column_name = 'tags'
    `);

    // If tags column doesn't exist yet (migration not run), return empty array
    if (columnCheck.rows.length === 0) {
      return res.json({
        success: true,
        tags: [],
      });
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

    const result = await pool.query(query, params);

    res.json({
      success: true,
      tags: result.rows.map((row: any, index: number) => ({
        tag_id: index + 1, // Generate unique ID for frontend
        tag_name: row.tag,
        product_count: parseInt(row.product_count),
      })),
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    // Return empty array if error (e.g., column doesn't exist)
    res.json({
      success: true,
      tags: [],
    });
  }
});

// Update product tags (JSONB array)
router.put('/products/:id/tags', authenticateUser, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tags } = req.body;
  const merchantId = (req as any).user?.merchant_id;
  const userId = (req as any).user?.user_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  if (!Array.isArray(tags)) {
    return res.status(400).json({
      success: false,
      error: 'Tags must be an array',
    });
  }

  try {
    const result = await pool.query(
      `UPDATE oms.products 
       SET tags = $1::jsonb, updated_by = $2
       WHERE product_id = $3 AND merchant_id = $4
       RETURNING *`,
      [JSON.stringify(tags), userId, id, merchantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.json({
      success: true,
      message: 'Tags updated successfully',
      product: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tags',
    });
  }
});

export default router;

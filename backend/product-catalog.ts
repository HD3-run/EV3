import { Router, Request, Response } from 'express';
import { pool } from './db';
import { authenticateUser } from './middleware/auth';
import multer from 'multer';
import { tmpdir } from 'os';

// Import queries
import { getCategoriesQuery } from './product-catalog/queries/category-queries';
import { checkProductColumns, buildProductListQuery, buildSingleProductQuery, transformProduct } from './product-catalog/queries/product-queries';
import { getTagsQuery } from './product-catalog/queries/tag-queries';

// Import services
import { createProductService, updateProductService, deleteProductService } from './product-catalog/services/productService';
import { uploadImageService, deleteImageService, setPrimaryImageService } from './product-catalog/services/imageService';
import { updateProductTagsService } from './product-catalog/services/tagService';

const router = Router();

// Configure multer with disk storage
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, tmpdir());
    },
    filename: (req, file, cb) => {
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

// Get categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.merchant_id || (req as any).session?.merchant_id;
    
    if (!merchantId) {
      return res.status(401).json({
        success: false,
        error: 'Merchant ID not found. Please log in.',
      });
    }
    
    const { query, params } = await getCategoriesQuery(pool, merchantId);
    const result = await pool.query(query, params);

    res.json({
      success: true,
      categories: result.rows.map((row: any) => ({
        category_id: row.category_name,
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
    category_id,
    search,
    is_featured,
    is_active = 'true',
  } = req.query;

  const merchantId = (req as any).user?.merchant_id || (req as any).session?.merchant_id;
  
  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found. Please log in.',
    });
  }

  // Ensure merchantId is a number
  const merchantIdNum = typeof merchantId === 'string' ? parseInt(merchantId) : merchantId;
  if (isNaN(merchantIdNum)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid merchant ID',
    });
  }

  try {
    // Check columns
    const columnChecks = await checkProductColumns(pool);
    
    // Handle both category (name) and category_id (which is actually the name)
    const categoryFilter = (category as string) || (category_id as string);
    
    // Build query
    const { query, params, countQuery, countParams } = buildProductListQuery(columnChecks, merchantIdNum, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      category: categoryFilter,
      search: search as string,
      is_featured: is_featured as string,
      is_active: is_active as string,
    });

    // Get total count (use countParams which excludes LIMIT/OFFSET)
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get products
    const result = await pool.query(query, params);

    // Transform products
    const transformedProducts = result.rows.map(transformProduct);

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
  } catch (error: any) {
    console.error('Error fetching products:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch products',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found. Please log in.',
    });
  }

  try {
    const { query, params } = await buildSingleProductQuery(pool, productId, merchantId);
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const transformedProduct = transformProduct(result.rows[0]);

    res.json({
      success: true,
      product: transformedProduct,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
    });
  }
});

// Create new product
router.post('/products', authenticateUser, async (req: Request, res: Response) => {
  const merchantId = (req as any).user?.merchant_id;
  const userId = (req as any).user?.user_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  if (!req.body.product_name) {
    return res.status(400).json({
      success: false,
      error: 'Product name is required',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const product = await createProductService(pool, client, merchantId, userId, req.body);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      product,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating product:', error);

    if (error.code === '23505' || error.message.includes('SKU already exists')) {
      return res.status(409).json({
        success: false,
        error: 'Product SKU already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create product',
    });
  } finally {
    client.release();
  }
});

// Update product
router.put('/products/:id', authenticateUser, async (req: Request, res: Response) => {
  const { id } = req.params;
  const merchantId = (req as any).user?.merchant_id;
  const userId = (req as any).user?.user_id;

  if (!merchantId) {
    return res.status(401).json({
      success: false,
      error: 'Merchant ID not found',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const product = await updateProductService(pool, client, parseInt(id), merchantId, userId, req.body);

    await client.query('COMMIT');

    res.json({
      success: true,
      product,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating product:', error);
    
    const statusCode = error.message.includes('not found') ? 404 : 
                      error.message.includes('No fields') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to update product',
    });
  } finally {
    client.release();
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await deleteProductService(client, parseInt(id), merchantId, userId);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Product deactivated successfully',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error deleting product:', error);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to delete product',
    });
  } finally {
    client.release();
  }
});

// Upload product image
router.post('/products/:id/images', authenticateUser, upload.single('image'), async (req: Request, res: Response) => {
  const { id } = req.params;
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
    await client.query('BEGIN');

    const image = await uploadImageService(
      client,
      parseInt(id),
      merchantId,
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.body
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      image,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error uploading product image:', error);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to upload product image',
    });
  } finally {
    client.release();
  }
});

// Delete product image
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
    await client.query('BEGIN');

    await deleteImageService(client, parseInt(productId), parseInt(catalogueId), merchantId);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error deleting product image:', error);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to delete product image',
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
    await client.query('BEGIN');

    await setPrimaryImageService(client, parseInt(productId), parseInt(catalogueId), merchantId);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Image set as primary successfully',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error setting primary image:', error);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to set primary image',
    });
  } finally {
    client.release();
  }
});

// Get all tags
router.get('/tags', async (req: Request, res: Response) => {
  const merchantId = (req as any).user?.merchant_id || (req as any).session?.merchant_id;

  try {
    const tagQuery = await getTagsQuery(pool, merchantId);
    
    if (!tagQuery) {
      // Tags column doesn't exist
      return res.json({
        success: true,
        tags: [],
      });
    }

    const result = await pool.query(tagQuery.query, tagQuery.params);

    res.json({
      success: true,
      tags: result.rows.map((row: any, index: number) => ({
        tag_id: index + 1,
        tag_name: row.tag,
        product_count: parseInt(row.product_count),
      })),
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.json({
      success: true,
      tags: [],
    });
  }
});

// Update product tags
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const product = await updateProductTagsService(client, parseInt(id), merchantId, userId, tags);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Tags updated successfully',
      product,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating tags:', error);
    
    const statusCode = error.message.includes('not found') ? 404 : 
                      error.message.includes('must be an array') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to update tags',
    });
  } finally {
    client.release();
  }
});

export default router;

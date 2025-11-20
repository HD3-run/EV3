import { Router, Request, Response } from 'express';
import { pool } from './db';

// Import services
import { getMerchantInfo } from './public-catalog/services/merchantService';
import { getPublicProductList, getPublicSingleProduct } from './public-catalog/services/productService';
import { getPublicCategories } from './public-catalog/services/categoryService';

const router = Router();

// Public catalog endpoints (no authentication required)
// These endpoints are used for shareable merchant catalog pages

// Get merchant info by merchant_id
router.get('/merchant/:merchantId', async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const result = await getMerchantInfo(pool, parseInt(merchantId));

  if (!result.success) {
    return res.status(result.error === 'Merchant not found' ? 404 : 500).json(result);
  }

  res.json(result);
});

// Get public products for a merchant (no auth required)
router.get('/merchant/:merchantId/products', async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const {
    page = '1',
    limit = '20',
    category,
    search,
    is_featured,
  } = req.query;

  const result = await getPublicProductList(pool, {
    merchantId: parseInt(merchantId),
    page: parseInt(page as string),
    limit: parseInt(limit as string),
    category: category as string,
    search: search as string,
    is_featured: is_featured as string,
  });

  if (!result.success) {
    return res.status(500).json(result);
  }

  res.json(result);
});

// Get single product for public catalog
router.get('/merchant/:merchantId/products/:productId', async (req: Request, res: Response) => {
  const { merchantId, productId } = req.params;

  const result = await getPublicSingleProduct(
    pool,
    parseInt(productId),
    parseInt(merchantId)
  );

  if (!result.success) {
    return res.status(result.error === 'Product not found' ? 404 : 500).json(result);
  }

  res.json(result);
});

// Get categories for public catalog
router.get('/merchant/:merchantId/categories', async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const result = await getPublicCategories(pool, parseInt(merchantId));

  if (!result.success) {
    return res.status(500).json(result);
  }

  res.json(result);
});

export default router;

import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import { buildPublicProductListQuery, buildPublicSingleProductQuery } from '../queries/product-queries';
import { checkPublicCatalogSchema } from '../queries/schema-check-queries';
import { transformPublicProducts, transformPublicProduct } from './product-transform-service';

export interface ProductListParams {
  merchantId: number;
  page: number;
  limit: number;
  category?: string;
  search?: string;
  is_featured?: string;
}

export interface ProductServiceResult {
  success: boolean;
  products?: any[];
  product?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export async function getPublicProductList(
  pool: Pool,
  params: ProductListParams
): Promise<ProductServiceResult> {
  try {
    // Check schema
    const schemaChecks = await checkPublicCatalogSchema(pool);

    // Build queries
    const { query, params: queryParams, countQuery, countParams } = buildPublicProductListQuery(
      schemaChecks,
      params
    );

    // Execute queries
    const [result, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, countParams)
    ]);

    const totalCount = parseInt(countResult.rows[0].count);
    const transformedProducts = transformPublicProducts(result.rows);

    return {
      success: true,
      products: transformedProducts,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / params.limit),
      },
    };
  } catch (error) {
    logger.error('Error fetching public products:', error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: 'Failed to fetch products',
    };
  }
}

export async function getPublicSingleProduct(
  pool: Pool,
  productId: number,
  merchantId: number
): Promise<ProductServiceResult> {
  try {
    // Check schema
    const schemaChecks = await checkPublicCatalogSchema(pool);

    // Build query
    const { query, params } = buildPublicSingleProductQuery(
      schemaChecks,
      productId,
      merchantId
    );

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Product not found',
      };
    }

    const transformedProduct = transformPublicProduct(result.rows[0]);

    return {
      success: true,
      product: transformedProduct,
    };
  } catch (error) {
    logger.error('Error fetching public product:', error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: 'Failed to fetch product',
    };
  }
}


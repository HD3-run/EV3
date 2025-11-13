// Product service - handles product creation, updates, and duplicate checking
import { logger } from '../../utils/logger';
import { checkProductDuplicate } from '../utils/duplicateCheck';
import {
  getUserMerchantId,
  createProduct,
  updateProduct,
  checkDuplicateSku,
  createProductWithInventory,
  updateProductPartial
} from '../queries/product-queries';
import { createInventoryRecord } from '../queries/inventory-queries';

export async function addProductService(
  client: any,
  userId: string,
  productData: {
    name: string;
    category: string;
    brand: string | null;
    description: string | null;
    stock: number;
    reorderLevel: number;
    unitPrice: number;
    sellingPrice: number;
    hsn_code: string | null;
    gst_rate: number;
  }
) {
  if (!productData.name) {
    throw new Error('Product name is required');
  }

  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  await client.query('BEGIN');

  // Check for duplicates and handle name conflicts
  const duplicateCheck = await checkProductDuplicate(client, merchantId, productData.name, productData.brand || null);

  if (duplicateCheck.isDuplicate) {
    await client.query('ROLLBACK');
    const existingBrand = duplicateCheck.existingProduct?.brand || 'No Brand';
    throw new Error(`Product "${productData.name}" with brand "${existingBrand}" already exists. Please use a different name or brand.`);
  }

  // Use modified name if there was a name conflict with different brand
  const finalProductName = duplicateCheck.modifiedName || productData.name;

  // Create product (database will auto-generate SKU)
  const productResult = await createProductWithInventory(client, merchantId, {
    name: finalProductName,
    category: productData.category,
    brand: productData.brand || null,
    description: productData.description || null,
    hsn_code: productData.hsn_code || null,
    gst_rate: productData.gst_rate || 18.00
  });

  const productId = productResult.product_id;
  const sku = productResult.sku;

  // Create inventory record
  await createInventoryRecord(
    client,
    merchantId,
    productId,
    sku,
    productData.stock,
    productData.reorderLevel,
    productData.unitPrice || 0,
    productData.sellingPrice || 0
  );

  await client.query('COMMIT');

  return {
    productId,
    sku,
    originalName: productData.name,
    finalName: finalProductName,
    nameModified: finalProductName !== productData.name
  };
}

export async function createBasicProductService(
  client: any,
  userId: string,
  productData: {
    name: string;
    sku: string | null;
    description: string | null;
    category: string;
    hsn_code: string | null;
    gst_rate: number;
  }
) {
  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  // Check for duplicate SKU within merchant
  if (productData.sku) {
    const isDuplicate = await checkDuplicateSku(client, merchantId, productData.sku);
    if (isDuplicate) {
      throw new Error('SKU already exists for this merchant');
    }
  }

  const product = await createProduct(client, merchantId, productData);
  return product;
}

export async function updateProductService(
  client: any,
  userId: string,
  productId: number,
  productData: {
    name: string;
    sku: string;
    description: string | null;
    category: string;
    hsn_code: string | null;
    gst_rate: number;
  }
) {
  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  const product = await updateProduct(client, productId, merchantId, productData);
  if (!product) {
    throw new Error('Product not found');
  }

  return product;
}

export async function updateProductPartialService(
  client: any,
  userId: string,
  productId: number,
  updateData: {
    productName?: string;
    brand?: string | null;
    description?: string | null;
    hsn_code?: string | null;
    gst_rate?: number;
  }
) {
  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  const updateFields: string[] = [];
  const updateValues: any[] = [];
  let paramIndex = 1;

  if (updateData.productName) {
    updateFields.push(`product_name = $${paramIndex++}`);
    updateValues.push(updateData.productName);
  }
  if (updateData.brand !== undefined) {
    updateFields.push(`brand = $${paramIndex++}`);
    updateValues.push(updateData.brand || null);
  }
  if (updateData.description !== undefined) {
    updateFields.push(`description = $${paramIndex++}`);
    updateValues.push(updateData.description || null);
  }
  if (updateData.hsn_code !== undefined) {
    updateFields.push(`hsn_code = $${paramIndex++}`);
    updateValues.push(updateData.hsn_code || null);
  }
  if (updateData.gst_rate !== undefined) {
    updateFields.push(`gst_rate = $${paramIndex++}`);
    updateValues.push(updateData.gst_rate || 18.00);
  }

  if (updateFields.length === 0) {
    return null;
  }

  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

  const product = await updateProductPartial(client, productId, merchantId, updateFields, updateValues);
  if (!product) {
    throw new Error('Product not found or not associated with your merchant');
  }

  return product;
}


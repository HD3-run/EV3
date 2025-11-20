// Inventory service - handles stock updates and bulk operations
import { logger } from '../../utils/logger';
import { getUserMerchantId } from '../queries/product-queries';
import {
  updateInventoryStock,
  updateInventoryBySku,
  updateInventoryByProductName,
  updateReorderLevel
} from '../queries/inventory-queries';

export async function updateStockService(
  client: any,
  userId: string,
  productId: number,
  quantity: number
) {
  if (quantity === undefined || quantity < 0) {
    throw new Error('Valid quantity is required');
  }

  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  const result = await updateInventoryStock(client, productId, merchantId, quantity);
  if (!result) {
    throw new Error('Product not found or not associated with your merchant');
  }

  return result;
}

export async function bulkUpdateInventoryService(
  client: any,
  userId: string,
  updates: Array<{ sku: string; stockQuantity: number }>
) {
  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  await client.query('BEGIN');
  const results: any[] = [];

  for (const update of updates) {
    const result = await updateInventoryBySku(
      client,
      update.sku,
      merchantId,
      update.stockQuantity
    );

    if (result) {
      results.push(result);
    }
  }

  await client.query('COMMIT');
  return results;
}

export async function updateStockByProductNameOrSku(
  client: any,
  merchantId: number,
  productData: {
    name?: string;
    sku?: string;
    stock: number;
  }
) {
  let updateResult;

  // Try to update by product name first
  if (productData.name) {
    updateResult = await updateInventoryByProductName(
      client,
      productData.name,
      merchantId,
      productData.stock
    );
  } else if (productData.sku) {
    // Update by SKU
    updateResult = await updateInventoryBySku(
      client,
      productData.sku,
      merchantId,
      productData.stock
    );
  }

  return updateResult;
}

export async function updateReorderLevelService(
  client: any,
  userId: string,
  productId: number,
  reorderLevel: number
) {
  if (reorderLevel === undefined || reorderLevel < 0) {
    throw new Error('Valid reorder level is required');
  }

  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  const result = await updateReorderLevel(client, productId, merchantId, reorderLevel);
  if (!result) {
    throw new Error('Product inventory not found or not associated with your merchant');
  }

  return result;
}

export async function updateProductAndInventoryService(
  client: any,
  userId: string,
  productId: number,
  updateData: {
    productName?: string;
    brand?: string | null;
    description?: string | null;
    quantity?: number;
    reorderLevel?: number;
    hsn_code?: string | null;
    gst_rate?: number;
  }
) {
  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  await client.query('BEGIN');

  try {
    // Update product details if provided
    if (updateData.productName || updateData.brand !== undefined || updateData.description !== undefined || updateData.hsn_code !== undefined || updateData.gst_rate !== undefined) {
      const { updateProductPartial } = await import('../queries/product-queries');
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
        const gstRate = typeof updateData.gst_rate === 'string' ? parseFloat(updateData.gst_rate) : (updateData.gst_rate || 18.00);
        updateValues.push(gstRate);
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        const productResult = await updateProductPartial(client, productId, merchantId, updateFields, updateValues);
        if (!productResult) {
          await client.query('ROLLBACK');
          throw new Error('Product not found or not associated with your merchant');
        }
      }
    }

    // Update stock if provided
    if (updateData.quantity !== undefined && updateData.quantity >= 0) {
      const inventoryResult = await updateInventoryStock(client, productId, merchantId, updateData.quantity);
      if (!inventoryResult) {
        await client.query('ROLLBACK');
        throw new Error('Product inventory not found or not associated with your merchant');
      }
    }

    // Update reorder level if provided
    if (updateData.reorderLevel !== undefined && updateData.reorderLevel >= 0) {
      const reorderResult = await updateReorderLevel(client, productId, merchantId, updateData.reorderLevel);
      if (!reorderResult) {
        await client.query('ROLLBACK');
        throw new Error('Product inventory not found or not associated with your merchant');
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}


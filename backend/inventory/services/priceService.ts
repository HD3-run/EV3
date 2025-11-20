// Price service - handles product price updates
import { logger } from '../../utils/logger';
import { getUserMerchantId } from '../queries/product-queries';
import { updateProductPrice, updateSellingPrice } from '../queries/price-queries';

export async function updatePriceService(
  client: any,
  userId: string,
  productId: number,
  unitPrice: number
) {
  if (unitPrice === undefined || unitPrice < 0) {
    throw new Error('Valid unit price is required');
  }

  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  const result = await updateProductPrice(client, productId, merchantId, unitPrice);
  if (!result) {
    throw new Error('Product not found');
  }

  return result;
}

export async function updateSellingPriceService(
  client: any,
  userId: string,
  productId: number,
  sellingPrice: number
) {
  if (sellingPrice === undefined || sellingPrice < 0) {
    throw new Error('Valid selling price is required');
  }

  const merchantId = await getUserMerchantId(client, userId);
  if (!merchantId) {
    throw new Error('User not found');
  }

  const result = await updateSellingPrice(client, productId, merchantId, sellingPrice);
  if (!result) {
    throw new Error('Product not found');
  }

  return result;
}


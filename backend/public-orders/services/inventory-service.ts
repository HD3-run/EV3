// Inventory service for public orders

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import * as productInventoryQueries from '../queries/product-inventory-queries';

/**
 * Update inventory and emit WebSocket notification
 */
export async function updateInventoryAndNotify(
  client: PoolClient,
  productId: number,
  quantity: number,
  merchantId: number,
  productName?: string,
  sku?: string
): Promise<number> {
  // Update inventory
  const updateQuery = productInventoryQueries.updateInventoryQuantityQuery(
    quantity,
    productId,
    merchantId
  );
  await client.query(updateQuery.query, updateQuery.queryParams);

  // Get updated inventory quantity for WebSocket notification
  const getQuery = productInventoryQueries.getUpdatedInventoryQuery(
    productId,
    merchantId
  );
  const updatedInventory = await client.query(getQuery.query, getQuery.queryParams);
  const newQuantity = updatedInventory.rows[0]?.quantity_available || 0;

  // Emit WebSocket event to notify frontend about inventory update
  const io = (global as any).io;
  if (io) {
    try {
      io.emit('inventory-updated', {
        productId: productId,
        quantity: newQuantity,
        productName: productName,
        sku: sku,
        timestamp: new Date().toISOString()
      });
      io.emit('inventory-stock-updated', {
        productId: productId,
        quantity: newQuantity,
        timestamp: new Date().toISOString()
      });
      logger.info('WebSocket event emitted for inventory update from public order', {
        productId: productId,
        quantity: newQuantity
      });
    } catch (error) {
      logger.warn('Could not emit WebSocket event for inventory update', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return newQuantity;
}


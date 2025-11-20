// Inventory notification service for returns module

import { PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import * as returnItemQueries from '../queries/return-item-queries';
import { invalidateUserCache } from '../../middleware/cache';

/**
 * Restock inventory and emit WebSocket events (single return)
 */
export async function emitInventoryRestockNotification(
  client: PoolClient,
  returnId: number,
  userId?: number
): Promise<void> {
  try {
    const io = (global as any).io;
    if (!io) {
      logger.warn('WebSocket io not available for inventory restock notification', { returnId });
      return;
    }

    // Get return items to restock inventory
    const query = returnItemQueries.getReturnItemsQuery(returnId);
    const returnItemsResult = await client.query(query.query, query.queryParams);

    logger.info('Starting inventory restock for return', {
      returnId,
      itemsFound: returnItemsResult.rows.length,
      items: returnItemsResult.rows.map(item => ({
        product_id: item.product_id,
        merchant_id: item.merchant_id,
        quantity: item.quantity
      }))
    });

    if (returnItemsResult.rows.length === 0) {
      logger.warn('No return items found for restocking', { returnId });
      return;
    }

    const restockedProducts: number[] = [];

    // Restock inventory and emit WebSocket events for each returned product
    for (const item of returnItemsResult.rows) {
      if (!item.product_id || !item.merchant_id) {
        logger.warn('Skipping inventory restock - missing product_id or merchant_id', { 
          item,
          product_id: item.product_id,
          merchant_id: item.merchant_id
        });
        continue;
      }

      try {
        // Restock inventory
        const restockQuery = returnItemQueries.restockInventoryQuery(
          item.quantity,
          item.product_id,
          item.merchant_id
        );
        await client.query(restockQuery.query, restockQuery.queryParams);

        // Get updated inventory quantity
        const getUpdatedQuery = returnItemQueries.getUpdatedInventoryAfterRestockQuery(
          item.product_id,
          item.merchant_id
        );
        const updatedInventoryResult = await client.query(getUpdatedQuery.query, getUpdatedQuery.queryParams);
        const updatedQuantity = updatedInventoryResult.rows[0]?.quantity_available || 0;

        logger.info('Inventory restocked for product', {
          productId: item.product_id,
          quantityAdded: item.quantity,
          newQuantity: updatedQuantity
        });

        // Emit inventory update events with the ACTUAL updated quantity
        io.emit('inventory-updated', {
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: updatedQuantity, // Send the ACTUAL updated quantity after restock
          timestamp: new Date().toISOString(),
          action: 'return_restocked',
          returnId: returnId
        });

        // Also emit the stock-updated event for compatibility
        io.emit('inventory-stock-updated', {
          productId: item.product_id,
          quantity: updatedQuantity,
          timestamp: new Date().toISOString()
        });

        restockedProducts.push(item.product_id);
      } catch (itemError) {
        logger.error('Error restocking individual product', {
          productId: item.product_id,
          merchantId: item.merchant_id,
          quantity: item.quantity,
          error: itemError instanceof Error ? itemError.message : String(itemError),
          stack: itemError instanceof Error ? itemError.stack : undefined
        });
        // Continue with other products even if one fails
      }
    }

    // Invalidate cache for the user to ensure fresh data
    if (userId) {
      invalidateUserCache(userId);
      logger.info('Cache invalidated for user after inventory restock', { userId });
    }

    logger.info('Inventory restocked and WebSocket events emitted', {
      returnId,
      itemsCount: returnItemsResult.rows.length,
      restockedProductsCount: restockedProducts.length,
      restockedProductIds: restockedProducts
    });
  } catch (error) {
    logger.error('Could not restock inventory or emit WebSocket events', {
      returnId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    // Re-throw the error so the caller can handle it
    throw error;
  }
}

/**
 * Restock inventory and emit WebSocket events (bulk returns)
 */
export async function emitBulkInventoryRestockNotification(
  client: PoolClient,
  returnIds: number[],
  userId?: number
): Promise<void> {
  try {
    const io = (global as any).io;
    if (!io) {
      logger.warn('WebSocket io not available for bulk inventory restock notification', { returnIds });
      return;
    }

    // Get return items for all updated returns
    const query = returnItemQueries.getBulkReturnItemsQuery(returnIds);
    const returnItemsResult = await client.query(query.query, query.queryParams);

    logger.info('Starting bulk inventory restock for returns', {
      returnIds,
      itemsFound: returnItemsResult.rows.length
    });

    if (returnItemsResult.rows.length === 0) {
      logger.warn('No return items found for bulk restocking', { returnIds });
      return;
    }

    const restockedProducts: number[] = [];

    // Restock inventory and emit WebSocket events for each returned product
    for (const item of returnItemsResult.rows) {
      if (!item.product_id || !item.merchant_id) {
        logger.warn('Skipping inventory restock - missing product_id or merchant_id', { 
          item,
          product_id: item.product_id,
          merchant_id: item.merchant_id
        });
        continue;
      }

      try {
        // Restock inventory
        const restockQuery = returnItemQueries.restockInventoryQuery(
          item.quantity,
          item.product_id,
          item.merchant_id
        );
        await client.query(restockQuery.query, restockQuery.queryParams);

        // Get updated inventory quantity
        const getUpdatedQuery = returnItemQueries.getUpdatedInventoryAfterRestockQuery(
          item.product_id,
          item.merchant_id
        );
        const updatedInventoryResult = await client.query(getUpdatedQuery.query, getUpdatedQuery.queryParams);
        const updatedQuantity = updatedInventoryResult.rows[0]?.quantity_available || 0;

        // Emit inventory update events with the ACTUAL updated quantity
        io.emit('inventory-updated', {
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: updatedQuantity, // Send the ACTUAL updated quantity after restock
          timestamp: new Date().toISOString(),
          action: 'bulk_return_restocked',
          returnId: item.return_id
        });

        // Also emit the stock-updated event for compatibility
        io.emit('inventory-stock-updated', {
          productId: item.product_id,
          quantity: updatedQuantity,
          timestamp: new Date().toISOString()
        });

        restockedProducts.push(item.product_id);
      } catch (itemError) {
        logger.error('Error restocking individual product in bulk operation', {
          productId: item.product_id,
          merchantId: item.merchant_id,
          quantity: item.quantity,
          returnId: item.return_id,
          error: itemError instanceof Error ? itemError.message : String(itemError)
        });
        // Continue with other products even if one fails
      }
    }

    // Invalidate cache for the user to ensure fresh data
    if (userId) {
      invalidateUserCache(userId);
      logger.info('Cache invalidated for user after bulk inventory restock', { userId });
    }

    logger.info('Bulk inventory restocked and WebSocket events emitted', {
      returnIds,
      itemsCount: returnItemsResult.rows.length,
      restockedProductsCount: restockedProducts.length,
      restockedProductIds: restockedProducts
    });
  } catch (error) {
    logger.error('Could not restock inventory or emit WebSocket events for bulk returns', {
      returnIds,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    // Re-throw the error so the caller can handle it
    throw error;
  }
}


import { Router, Request, Response } from 'express';
import { pool } from './db';
import { logger } from './utils/logger';
import * as returnQueries from './returns/queries/return-queries';
import * as merchantService from './returns/services/merchant-service';
import { updateReturnStatus, bulkUpdateReturnStatus } from './returns/services/status-update-service';
import { emitInventoryRestockNotification, emitBulkInventoryRestockNotification } from './returns/services/inventory-notification-service';

const router = Router();

// Get all returns with pagination
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);
    
    const userId = parseInt((req as any).session.userId, 10);
    const merchantId = await merchantService.getMerchantId(client, userId);
    
    const query = returnQueries.getReturnsQuery(merchantId, limitNum, offset);
    const returnsResult = await client.query(query.query, query.queryParams);
    
    res.json({ 
      returns: returnsResult.rows,
      pagination: {
        page: Number(page),
        limit: limitNum,
        total: returnsResult.rows[0]?.total_count || 0,
        totalPages: Math.ceil((returnsResult.rows[0]?.total_count || 0) / limitNum)
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return res.status(401).json({ message: 'User not found' });
    }
    logger.error('Error fetching returns', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch returns' });
  } finally {
    client.release();
  }
});

// Get single return details (optimized single query)
router.get('/:returnId', async (req: Request, res: Response) => {
  const { returnId } = req.params;
  const client = await pool.connect();
  
  try {
    const userId = parseInt((req as any).session.userId, 10);
    const merchantId = await merchantService.getMerchantId(client, userId);
    
    const query = returnQueries.getReturnByIdQuery(parseInt(returnId, 10), merchantId);
    const returnResult = await client.query(query.query, query.queryParams);
    
    if (returnResult.rows.length === 0) {
      return res.status(404).json({ message: 'Return not found' });
    }
    
    res.json({ return: returnResult.rows[0] });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return res.status(401).json({ message: 'User not found' });
    }
    logger.error('Error fetching return details', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch return details' });
  } finally {
    client.release();
  }
});

// Universal status update endpoint (handles all status types)
router.patch('/:returnId/status', async (req: Request, res: Response) => {
  const { returnId } = req.params;
  const { approval_status, receipt_status, status } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = parseInt((req as any).session.userId, 10);
    const merchantId = await merchantService.getMerchantId(client, userId);
    
    // Update status using service
    const updatedReturn = await updateReturnStatus(
      client,
      parseInt(returnId, 10),
      merchantId,
      { approval_status, receipt_status, status }
    );
    
    logger.info('Status update completed, committing transaction', {
      returnId: parseInt(returnId, 10),
      receipt_status,
      updatedReturnStatus: updatedReturn.receipt_status
    });
    
    // Commit the status update FIRST
    await client.query('COMMIT');
    logger.info('Transaction committed successfully', { returnId: parseInt(returnId, 10) });
    
    // Restock inventory AFTER commit (so status update is guaranteed to persist)
    // If restocking fails, it won't affect the status update
    if (receipt_status !== undefined && ['received', 'inspected'].includes(receipt_status)) {
      try {
        // Use a new connection for restocking since we've already committed
        const restockClient = await pool.connect();
        try {
          await emitInventoryRestockNotification(restockClient, parseInt(returnId, 10), userId);
          logger.info('Inventory restocking completed successfully', { returnId: parseInt(returnId, 10) });
        } finally {
          restockClient.release();
        }
      } catch (restockError) {
        // Log the error but don't fail - status update already committed
        logger.error('Failed to restock inventory after return status update', {
          returnId: parseInt(returnId, 10),
          error: restockError instanceof Error ? restockError.message : String(restockError),
          stack: restockError instanceof Error ? restockError.stack : undefined
        });
        // Continue - status update already succeeded
      }
    }
    
    const response: any = { 
      message: 'Return status updated successfully',
      return: updatedReturn
    };
    
    // Add special message for receipt status updates
    if (receipt_status !== undefined) {
      response.inventory_restocked = true;
      response.message += ' Inventory has been automatically restocked.';
    }
    
    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(401).json({ message: 'User not found' });
      }
      
      if (error.message.includes('Invalid') || error.message.includes('No valid')) {
        return res.status(400).json({ message: error.message });
      }
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
    }
    
    logger.error('Error updating return status', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update return status' });
  } finally {
    client.release();
  }
});

// Bulk status update endpoint for multiple returns
router.patch('/bulk-status', async (req: Request, res: Response) => {
  const { returnIds, approval_status, receipt_status, status } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = parseInt((req as any).session.userId, 10);
    const merchantId = await merchantService.getMerchantId(client, userId);
    
    if (!Array.isArray(returnIds) || returnIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'returnIds must be a non-empty array' });
    }
    
    // Update status using service
    const updatedReturnIds = await bulkUpdateReturnStatus(
      client,
      returnIds.map((id: any) => parseInt(id, 10)),
      merchantId,
      { approval_status, receipt_status, status }
    );
    
    // Commit the status update FIRST
    await client.query('COMMIT');
    
    // Restock inventory AFTER commit (so status update is guaranteed to persist)
    // If restocking fails, it won't affect the status update
    if (receipt_status !== undefined && ['received', 'inspected'].includes(receipt_status)) {
      try {
        // Use a new connection for restocking since we've already committed
        const restockClient = await pool.connect();
        try {
          await emitBulkInventoryRestockNotification(
            restockClient,
            returnIds.map((id: any) => parseInt(id, 10)),
            userId
          );
        } finally {
          restockClient.release();
        }
      } catch (restockError) {
        // Log the error but don't fail - status update already committed
        logger.error('Failed to restock inventory after bulk return status update', {
          returnIds: returnIds.map((id: any) => parseInt(id, 10)),
          error: restockError instanceof Error ? restockError.message : String(restockError)
        });
      }
    }
    
    res.json({ 
      message: `Successfully updated ${updatedReturnIds.length} returns`,
      updated_return_ids: updatedReturnIds,
      inventory_restocked: receipt_status !== undefined
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(401).json({ message: 'User not found' });
      }
      
      if (error.message.includes('Invalid') || error.message.includes('No valid')) {
        return res.status(400).json({ message: error.message });
      }
    }
    
    logger.error('Error bulk updating return status', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to bulk update return status' });
  } finally {
    client.release();
  }
});

export default router;

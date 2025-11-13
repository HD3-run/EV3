"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("./db");
const logger_1 = require("./utils/logger");
const router = (0, express_1.Router)();
// Helper function to get merchant ID (reused across endpoints)
const getMerchantId = async (req) => {
    const userResult = await db_1.pool.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
    if (userResult.rows.length === 0) {
        throw new Error('User not found');
    }
    return userResult.rows[0].merchant_id;
};
// Get all returns with pagination
router.get('/', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const limitNum = Number(limit);
        const merchantId = await getMerchantId(req);
        // Single optimized query with JSON aggregation for return items and pagination
        const returnsResult = await client.query(`
      SELECT 
        r.return_id,
        r.order_id,
        r.customer_id,
        r.reason,
        r.total_refund_amount,
        r.approval_status,
        r.receipt_status,
        r.status,
        r.return_date,
        r.created_at,
        r.updated_at,
        o.order_date,
        o.total_amount as order_total,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        COUNT(*) OVER() as total_count,
        COALESCE(
          json_agg(
            json_build_object(
              'return_item_id', ri.return_item_id,
              'quantity', ri.quantity,
              'unit_price', ri.unit_price,
              'total_amount', ri.total_amount,
              'product_name', p.product_name,
              'sku', p.sku,
              'brand', p.brand,
              'category', p.category
            )
          ) FILTER (WHERE ri.return_item_id IS NOT NULL),
          '[]'::json
        ) as return_items
      FROM oms.order_returns r
      LEFT JOIN oms.orders o ON r.order_id = o.order_id
      LEFT JOIN oms.customers c ON r.customer_id = c.customer_id
      LEFT JOIN oms.order_return_items ri ON r.return_id = ri.return_id
      LEFT JOIN oms.products p ON ri.product_id = p.product_id
      WHERE r.merchant_id = $1
      GROUP BY r.return_id, r.order_id, r.customer_id, r.reason, r.total_refund_amount,
               r.approval_status, r.receipt_status, r.status, r.return_date, r.created_at, r.updated_at,
               o.order_date, o.total_amount, c.name, c.phone, c.email
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [merchantId, limitNum, offset]);
        res.json({
            returns: returnsResult.rows,
            pagination: {
                page: Number(page),
                limit: limitNum,
                total: returnsResult.rows[0]?.total_count || 0,
                totalPages: Math.ceil((returnsResult.rows[0]?.total_count || 0) / limitNum)
            }
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'User not found') {
            return res.status(401).json({ message: 'User not found' });
        }
        logger_1.logger.error('Error fetching returns', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to fetch returns' });
    }
    finally {
        client.release();
    }
});
// Get single return details (optimized single query)
router.get('/:returnId', async (req, res) => {
    const { returnId } = req.params;
    const client = await db_1.pool.connect();
    try {
        const merchantId = await getMerchantId(req);
        // Single optimized query with JSON aggregation
        const returnResult = await client.query(`
      SELECT 
        r.return_id,
        r.order_id,
        r.customer_id,
        r.reason,
        r.total_refund_amount,
        r.approval_status,
        r.receipt_status,
        r.status,
        r.return_date,
        r.created_at,
        r.updated_at,
        o.order_date,
        o.total_amount as order_total,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        COALESCE(
          json_agg(
            json_build_object(
              'return_item_id', ri.return_item_id,
              'quantity', ri.quantity,
              'unit_price', ri.unit_price,
              'total_amount', ri.total_amount,
              'product_name', p.product_name,
              'sku', p.sku,
              'brand', p.brand,
              'category', p.category
            )
          ) FILTER (WHERE ri.return_item_id IS NOT NULL),
          '[]'::json
        ) as return_items
      FROM oms.order_returns r
      LEFT JOIN oms.orders o ON r.order_id = o.order_id
      LEFT JOIN oms.customers c ON r.customer_id = c.customer_id
      LEFT JOIN oms.order_return_items ri ON r.return_id = ri.return_id
      LEFT JOIN oms.products p ON ri.product_id = p.product_id
      WHERE r.return_id = $1 AND r.merchant_id = $2
      GROUP BY r.return_id, r.order_id, r.customer_id, r.reason, r.total_refund_amount,
               r.approval_status, r.receipt_status, r.status, r.return_date, r.created_at, r.updated_at,
               o.order_date, o.total_amount, c.name, c.phone, c.email
    `, [returnId, merchantId]);
        if (returnResult.rows.length === 0) {
            return res.status(404).json({ message: 'Return not found' });
        }
        res.json({ return: returnResult.rows[0] });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'User not found') {
            return res.status(401).json({ message: 'User not found' });
        }
        logger_1.logger.error('Error fetching return details', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to fetch return details' });
    }
    finally {
        client.release();
    }
});
// Universal status update endpoint (handles all status types)
router.patch('/:returnId/status', async (req, res) => {
    const { returnId } = req.params;
    const { approval_status, receipt_status, status } = req.body;
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const merchantId = await getMerchantId(req);
        // Build dynamic update query based on provided fields
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (approval_status !== undefined) {
            const validApprovalStatuses = ['pending', 'approved', 'rejected'];
            if (!validApprovalStatuses.includes(approval_status)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Invalid approval_status. Must be one of: ${validApprovalStatuses.join(', ')}`
                });
            }
            updates.push(`approval_status = $${paramIndex++}`);
            values.push(approval_status);
            // If approval_status is set to 'rejected', automatically set receipt_status to 'rejected'
            if (approval_status === 'rejected') {
                updates.push(`receipt_status = $${paramIndex++}`);
                values.push('rejected');
            }
        }
        if (receipt_status !== undefined) {
            const validReceiptStatuses = ['pending', 'received', 'inspected', 'rejected'];
            if (!validReceiptStatuses.includes(receipt_status)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Invalid receipt_status. Must be one of: ${validReceiptStatuses.join(', ')}`
                });
            }
            updates.push(`receipt_status = $${paramIndex++}`);
            values.push(receipt_status);
        }
        if (status !== undefined) {
            const validStatuses = ['pending', 'processed'];
            if (!validStatuses.includes(status)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }
        if (updates.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No valid status fields provided' });
        }
        // Add updated_at and WHERE clause parameters
        updates.push('updated_at = NOW()');
        values.push(returnId, merchantId);
        const updateQuery = `
      UPDATE oms.order_returns 
      SET ${updates.join(', ')} 
      WHERE return_id = $${paramIndex++} AND merchant_id = $${paramIndex++} 
      RETURNING *
    `;
        const result = await client.query(updateQuery, values);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Return not found or not associated with your merchant' });
        }
        await client.query('COMMIT');
        // Log the update with special note for receipt_status (triggers inventory restock)
        const logData = { returnId, merchantId };
        if (approval_status !== undefined)
            logData.approvalStatus = approval_status;
        if (receipt_status !== undefined) {
            logData.receiptStatus = receipt_status;
            logData.note = 'INVENTORY RESTOCK TRIGGERED by receipt_status update!';
        }
        if (status !== undefined)
            logData.status = status;
        logger_1.logger.info('Return status updated', logData);
        // Emit WebSocket events for inventory updates when receipt_status changes
        if (receipt_status !== undefined && ['received', 'inspected'].includes(receipt_status)) {
            try {
                const io = global.io;
                if (io) {
                    // Get return items to notify about inventory updates
                    const returnItemsResult = await client.query(`
            SELECT 
              ri.product_id,
              ri.quantity,
              p.product_name,
              p.sku
            FROM oms.order_return_items ri
            LEFT JOIN oms.products p ON ri.product_id = p.product_id
            WHERE ri.return_id = $1
          `, [returnId]);
                    // Emit inventory update events for each returned product
                    for (const item of returnItemsResult.rows) {
                        io.emit('inventory-updated', {
                            productId: item.product_id,
                            productName: item.product_name,
                            sku: item.sku,
                            quantity: item.quantity, // This quantity was added back to inventory
                            timestamp: new Date().toISOString(),
                            action: 'return_restocked',
                            returnId: returnId
                        });
                    }
                    logger_1.logger.info('WebSocket events emitted for inventory restock', {
                        returnId,
                        itemsCount: returnItemsResult.rows.length
                    });
                }
            }
            catch (error) {
                logger_1.logger.warn('Could not emit WebSocket events for inventory restock', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        const response = {
            message: 'Return status updated successfully',
            return: result.rows[0]
        };
        // Add special message for receipt status updates
        if (receipt_status !== undefined) {
            response.inventory_restocked = true;
            response.message += ' Inventory has been automatically restocked.';
        }
        res.json(response);
    }
    catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof Error && error.message === 'User not found') {
            return res.status(401).json({ message: 'User not found' });
        }
        logger_1.logger.error('Error updating return status', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update return status' });
    }
    finally {
        client.release();
    }
});
// Bulk status update endpoint for multiple returns
router.patch('/bulk-status', async (req, res) => {
    const { returnIds, approval_status, receipt_status, status } = req.body;
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const merchantId = await getMerchantId(req);
        if (!Array.isArray(returnIds) || returnIds.length === 0) {
            return res.status(400).json({ message: 'returnIds must be a non-empty array' });
        }
        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (approval_status !== undefined) {
            const validApprovalStatuses = ['pending', 'approved', 'rejected'];
            if (!validApprovalStatuses.includes(approval_status)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Invalid approval_status. Must be one of: ${validApprovalStatuses.join(', ')}`
                });
            }
            updates.push(`approval_status = $${paramIndex++}`);
            values.push(approval_status);
            // If approval_status is set to 'rejected', automatically set receipt_status to 'rejected'
            if (approval_status === 'rejected') {
                updates.push(`receipt_status = $${paramIndex++}`);
                values.push('rejected');
            }
        }
        if (receipt_status !== undefined) {
            const validReceiptStatuses = ['pending', 'received', 'inspected', 'rejected'];
            if (!validReceiptStatuses.includes(receipt_status)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Invalid receipt_status. Must be one of: ${validReceiptStatuses.join(', ')}`
                });
            }
            updates.push(`receipt_status = $${paramIndex++}`);
            values.push(receipt_status);
        }
        if (status !== undefined) {
            const validStatuses = ['pending', 'processed'];
            if (!validStatuses.includes(status)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }
        if (updates.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No valid status fields provided' });
        }
        // Add updated_at and WHERE clause parameters
        updates.push('updated_at = NOW()');
        values.push(merchantId);
        const updateQuery = `
      UPDATE oms.order_returns 
      SET ${updates.join(', ')} 
      WHERE return_id = ANY($${paramIndex++}) AND merchant_id = $${paramIndex - 2} 
      RETURNING return_id
    `;
        const result = await client.query(updateQuery, [...values, returnIds]);
        await client.query('COMMIT');
        // Emit WebSocket events for inventory updates when receipt_status changes
        if (receipt_status !== undefined && ['received', 'inspected'].includes(receipt_status)) {
            try {
                const io = global.io;
                if (io) {
                    // Get return items for all updated returns
                    const returnItemsResult = await client.query(`
            SELECT 
              ri.return_id,
              ri.product_id,
              ri.quantity,
              p.product_name,
              p.sku
            FROM oms.order_return_items ri
            LEFT JOIN oms.products p ON ri.product_id = p.product_id
            WHERE ri.return_id = ANY($1)
          `, [returnIds]);
                    // Emit inventory update events for each returned product
                    for (const item of returnItemsResult.rows) {
                        io.emit('inventory-updated', {
                            productId: item.product_id,
                            productName: item.product_name,
                            sku: item.sku,
                            quantity: item.quantity,
                            timestamp: new Date().toISOString(),
                            action: 'bulk_return_restocked',
                            returnId: item.return_id
                        });
                    }
                    logger_1.logger.info('WebSocket events emitted for bulk inventory restock', {
                        returnIds,
                        itemsCount: returnItemsResult.rows.length
                    });
                }
            }
            catch (error) {
                logger_1.logger.warn('Could not emit WebSocket events for bulk inventory restock', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        logger_1.logger.info('Bulk return status update completed', {
            returnIds,
            updatedCount: result.rows.length,
            merchantId,
            updates: { approval_status, receipt_status, status }
        });
        res.json({
            message: `Successfully updated ${result.rows.length} returns`,
            updated_return_ids: result.rows.map(row => row.return_id),
            inventory_restocked: receipt_status !== undefined
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof Error && error.message === 'User not found') {
            return res.status(401).json({ message: 'User not found' });
        }
        logger_1.logger.error('Error bulk updating return status', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to bulk update return status' });
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=returns.js.map
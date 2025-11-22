"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("./db");
const logger_1 = require("./utils/logger");
const returnQueries = __importStar(require("./returns/queries/return-queries"));
const merchantService = __importStar(require("./returns/services/merchant-service"));
const status_update_service_1 = require("./returns/services/status-update-service");
const inventory_notification_service_1 = require("./returns/services/inventory-notification-service");
const router = (0, express_1.Router)();
// Get all returns with pagination
router.get('/', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const limitNum = Number(limit);
        const userId = parseInt(req.session.userId, 10);
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
        const userId = parseInt(req.session.userId, 10);
        const merchantId = await merchantService.getMerchantId(client, userId);
        const query = returnQueries.getReturnByIdQuery(parseInt(returnId, 10), merchantId);
        const returnResult = await client.query(query.query, query.queryParams);
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
        const userId = parseInt(req.session.userId, 10);
        const merchantId = await merchantService.getMerchantId(client, userId);
        // Update status using service
        const updatedReturn = await (0, status_update_service_1.updateReturnStatus)(client, parseInt(returnId, 10), merchantId, { approval_status, receipt_status, status });
        logger_1.logger.info('Status update completed, committing transaction', {
            returnId: parseInt(returnId, 10),
            receipt_status,
            updatedReturnStatus: updatedReturn.receipt_status
        });
        // Commit the status update FIRST
        await client.query('COMMIT');
        logger_1.logger.info('Transaction committed successfully', { returnId: parseInt(returnId, 10) });
        // Restock inventory AFTER commit (so status update is guaranteed to persist)
        // If restocking fails, it won't affect the status update
        if (receipt_status !== undefined && ['received', 'inspected'].includes(receipt_status)) {
            try {
                // Use a new connection for restocking since we've already committed
                const restockClient = await db_1.pool.connect();
                try {
                    await (0, inventory_notification_service_1.emitInventoryRestockNotification)(restockClient, parseInt(returnId, 10), userId);
                    logger_1.logger.info('Inventory restocking completed successfully', { returnId: parseInt(returnId, 10) });
                }
                finally {
                    restockClient.release();
                }
            }
            catch (restockError) {
                // Log the error but don't fail - status update already committed
                logger_1.logger.error('Failed to restock inventory after return status update', {
                    returnId: parseInt(returnId, 10),
                    error: restockError instanceof Error ? restockError.message : String(restockError),
                    stack: restockError instanceof Error ? restockError.stack : undefined
                });
                // Continue - status update already succeeded
            }
        }
        const response = {
            message: 'Return status updated successfully',
            return: updatedReturn
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
        const userId = parseInt(req.session.userId, 10);
        const merchantId = await merchantService.getMerchantId(client, userId);
        if (!Array.isArray(returnIds) || returnIds.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'returnIds must be a non-empty array' });
        }
        // Update status using service
        const updatedReturnIds = await (0, status_update_service_1.bulkUpdateReturnStatus)(client, returnIds.map((id) => parseInt(id, 10)), merchantId, { approval_status, receipt_status, status });
        // Commit the status update FIRST
        await client.query('COMMIT');
        // Restock inventory AFTER commit (so status update is guaranteed to persist)
        // If restocking fails, it won't affect the status update
        if (receipt_status !== undefined && ['received', 'inspected'].includes(receipt_status)) {
            try {
                // Use a new connection for restocking since we've already committed
                const restockClient = await db_1.pool.connect();
                try {
                    await (0, inventory_notification_service_1.emitBulkInventoryRestockNotification)(restockClient, returnIds.map((id) => parseInt(id, 10)), userId);
                }
                finally {
                    restockClient.release();
                }
            }
            catch (restockError) {
                // Log the error but don't fail - status update already committed
                logger_1.logger.error('Failed to restock inventory after bulk return status update', {
                    returnIds: returnIds.map((id) => parseInt(id, 10)),
                    error: restockError instanceof Error ? restockError.message : String(restockError)
                });
            }
        }
        res.json({
            message: `Successfully updated ${updatedReturnIds.length} returns`,
            updated_return_ids: updatedReturnIds,
            inventory_restocked: receipt_status !== undefined
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        if (error instanceof Error) {
            if (error.message === 'User not found') {
                return res.status(401).json({ message: 'User not found' });
            }
            if (error.message.includes('Invalid') || error.message.includes('No valid')) {
                return res.status(400).json({ message: error.message });
            }
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
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("./db");
const logger_1 = require("./utils/logger");
const validation_1 = require("./utils/validation");
const validation_2 = require("./middleware/validation");
const cache_1 = require("./middleware/cache");
const multer_1 = __importDefault(require("multer"));
// Import queries
const product_queries_1 = require("./inventory/queries/product-queries");
// Import services
const productService_1 = require("./inventory/services/productService");
const inventoryService_1 = require("./inventory/services/inventoryService");
const priceService_1 = require("./inventory/services/priceService");
const csvService_1 = require("./inventory/services/csvService");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const router = (0, express_1.Router)();
// Get all products with pagination and filtering
router.get('/', validation_2.validatePagination, (0, cache_1.cacheMiddleware)(60), async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { page = 1, limit = 20, category, search, lowStock, stockStatus } = req.query;
        const limitNum = Number(limit) || 20;
        console.log('🔍 Inventory API - Request params:', { page, limit, category, search, lowStock, stockStatus });
        console.log('👤 Session userId:', req.session?.userId);
        const merchantId = await (0, product_queries_1.getUserMerchantId)(client, req.session.userId);
        if (!merchantId) {
            return res.status(401).json({ message: 'User not found' });
        }
        console.log('🏪 Merchant ID:', merchantId);
        const result = await (0, product_queries_1.getProductsWithFilters)(client, merchantId, {
            page: Number(page),
            limit: limitNum,
            category: category,
            search: search,
            lowStock: lowStock,
            stockStatus: stockStatus
        });
        console.log('📊 Query result:', {
            rowCount: result.rows.length,
            totalCount: result.rows[0]?.total_count,
            firstRow: result.rows[0]
        });
        res.json({
            products: result.rows,
            pagination: {
                page: Number(page),
                limit: limitNum,
                total: result.rows[0]?.total_count || 0,
                totalPages: Math.ceil((result.rows[0]?.total_count || 0) / limitNum)
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching products', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to fetch products' });
    }
    finally {
        client.release();
    }
});
// Create new product
router.post('/', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { name, sku, description, category, hsn_code, gst_rate } = req.body;
        // Validate input
        const validation = (0, validation_1.validateProduct)({ name, sku, description, category });
        if (!validation.isValid) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: validation.errors
            });
        }
        const product = await (0, productService_1.createBasicProductService)(client, req.session.userId, {
            name,
            sku,
            description,
            category,
            hsn_code,
            gst_rate: gst_rate || 18.00
        });
        // Invalidate cache after creating product
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.status(201).json({
            message: 'Product created successfully',
            product
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating product', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && error.message.includes('SKU already exists') ? 409 : 500;
        res.status(statusCode).json({
            message: error instanceof Error ? error.message : 'Failed to create product',
            error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
        });
    }
    finally {
        client.release();
    }
});
// Update product
router.put('/:id', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { name, sku, description, category, hsn_code, gst_rate } = req.body;
        const product = await (0, productService_1.updateProductService)(client, req.session.userId, parseInt(id), {
            name,
            sku,
            description,
            category,
            hsn_code,
            gst_rate: gst_rate || 18.00
        });
        res.json(product);
    }
    catch (error) {
        logger_1.logger.error('Error updating product', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error instanceof Error ? error.message : 'Failed to update product' });
    }
    finally {
        client.release();
    }
});
// Get low stock products
router.get('/low-stock', (0, cache_1.cacheMiddleware)(30), async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const merchantId = await (0, product_queries_1.getUserMerchantId)(client, req.session.userId);
        if (!merchantId) {
            return res.status(401).json({ message: 'User not found' });
        }
        const result = await (0, product_queries_1.getLowStockProducts)(client, merchantId);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Error fetching low stock products', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to fetch low stock products' });
    }
    finally {
        client.release();
    }
});
// Bulk update inventory
router.post('/bulk-update', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { updates } = req.body;
        const results = await (0, inventoryService_1.bulkUpdateInventoryService)(client, req.session.userId, updates);
        // Invalidate user cache immediately after commit to ensure fresh data
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({ message: `${results.length} products updated successfully`, products: results });
    }
    catch (error) {
        logger_1.logger.error('Error bulk updating inventory', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update inventory' });
    }
    finally {
        client.release();
    }
});
// CSV upload endpoint for stock updates
router.post('/update-stock-csv', upload.single('file'), async (req, res) => {
    logger_1.logger.info('POST /api/inventory/update-stock-csv - Request received', {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        userId: req.session?.userId,
        sessionExists: !!req.session
    });
    const client = await db_1.pool.connect();
    const uploadId = req.body.uploadId || `stock_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        if (!req.file) {
            logger_1.logger.error('No file uploaded for stock update');
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const result = await (0, csvService_1.processStockUpdateCSV)(client, req.session.userId, req.file.buffer, uploadId);
        // Invalidate user cache immediately after commit to ensure fresh data
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({
            message: `Successfully updated stock for ${result.updated} products`,
            updated: result.updated,
            errors: result.errors,
            errorDetails: result.errorDetails,
            uploadId
        });
    }
    catch (error) {
        logger_1.logger.error('Error processing stock update CSV upload - DETAILED', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && (error.message.includes('not found') || error.message.includes('No valid')) ? 400 : 500;
        res.status(statusCode).json({
            message: error instanceof Error ? error.message : 'Failed to process CSV upload',
            error: error instanceof Error ? error.message : String(error)
        });
    }
    finally {
        client.release();
    }
});
// CSV upload endpoint for inventory
router.post('/upload-csv', upload.single('file'), async (req, res) => {
    logger_1.logger.info('POST /api/inventory/upload-csv - Request received', {
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        userId: req.session?.userId,
        sessionExists: !!req.session
    });
    const client = await db_1.pool.connect();
    const uploadId = req.body.uploadId || `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        if (!req.file) {
            logger_1.logger.error('No file uploaded');
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const result = await (0, csvService_1.processProductCSV)(client, req.session.userId, req.file.buffer, uploadId);
        // Invalidate user cache immediately after commit to ensure fresh data
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({
            message: `Successfully processed ${result.created} products using BATCH PROCESSING`,
            created: result.created,
            errors: result.errors,
            errorDetails: result.errorDetails,
            uploadId,
            batchProcessing: true,
            totalBatches: Math.ceil((result.created + result.errors) / 500),
            batchSize: 500,
            processingMethod: 'Batch Processing (500 items per batch)'
        });
    }
    catch (error) {
        logger_1.logger.error('Error processing inventory CSV upload - DETAILED', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && (error.message.includes('not found') || error.message.includes('No valid')) ? 400 : 500;
        res.status(statusCode).json({
            message: error instanceof Error ? error.message : 'Failed to process CSV upload',
            error: error instanceof Error ? error.message : String(error)
        });
    }
    finally {
        client.release();
    }
});
// Update product cost price
router.patch('/:id/price', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { unitPrice } = req.body;
        await (0, priceService_1.updatePriceService)(client, req.session.userId, parseInt(id), unitPrice);
        // Emit WebSocket event to notify frontend about price update
        try {
            const io = global.io;
            if (io) {
                io.emit('inventory-price-updated', {
                    productId: parseInt(id),
                    unitPrice: unitPrice,
                    timestamp: new Date().toISOString()
                });
                logger_1.logger.info('WebSocket event emitted for inventory price update', { productId: id, unitPrice });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event for inventory price update', { error: error instanceof Error ? error.message : String(error) });
        }
        res.json({ message: 'Cost price updated successfully' });
    }
    catch (error) {
        logger_1.logger.error('Error updating product cost price', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
            error instanceof Error && error.message.includes('Valid') ? 400 : 500;
        res.status(statusCode).json({ message: error instanceof Error ? error.message : 'Failed to update cost price' });
    }
    finally {
        client.release();
    }
});
router.patch('/:id/selling-price', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { sellingPrice } = req.body;
        await (0, priceService_1.updateSellingPriceService)(client, req.session.userId, parseInt(id), sellingPrice);
        // Emit WebSocket event to notify frontend about selling price update
        try {
            const io = global.io;
            if (io) {
                io.emit('inventory-selling-price-updated', {
                    productId: parseInt(id),
                    sellingPrice: sellingPrice,
                    timestamp: new Date().toISOString()
                });
                logger_1.logger.info('WebSocket event emitted for inventory selling price update', { productId: id, sellingPrice });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event for inventory selling price update', { error: error instanceof Error ? error.message : String(error) });
        }
        res.json({ message: 'Selling price updated successfully' });
    }
    catch (error) {
        logger_1.logger.error('Error updating product selling price', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
            error instanceof Error && error.message.includes('Valid') ? 400 : 500;
        res.status(statusCode).json({ message: error instanceof Error ? error.message : 'Failed to update selling price' });
    }
    finally {
        client.release();
    }
});
// Add single product with inventory
router.post('/add-product', validation_2.validateQuantity, async (req, res) => {
    logger_1.logger.info('POST /api/inventory/add-product - Request received', {
        body: req.body,
        userId: req.session?.userId,
        sessionExists: !!req.session
    });
    const client = await db_1.pool.connect();
    try {
        const { name, category, brand, description, stock, reorderLevel, unitPrice, sellingPrice, hsn_code, gst_rate } = req.body;
        logger_1.logger.info('Extracted request data', { name, category, stock, reorderLevel, unitPrice, sellingPrice });
        const result = await (0, productService_1.addProductService)(client, req.session.userId, {
            name,
            category,
            brand,
            description,
            stock,
            reorderLevel,
            unitPrice,
            sellingPrice,
            hsn_code,
            gst_rate: gst_rate || 18.00
        });
        logger_1.logger.info('Manual product addition completed - inventory should be refreshed');
        // Invalidate user cache immediately after commit
        (0, cache_1.invalidateUserCache)(req.session.userId);
        // Emit WebSocket event to notify frontend about new product
        try {
            const io = global.io;
            if (io) {
                io.emit('inventory-product-added', {
                    productId: result.productId,
                    productName: name,
                    sku: result.sku,
                    category: category,
                    brand: brand,
                    description: description,
                    stock: stock,
                    reorderLevel: reorderLevel,
                    unitPrice: unitPrice || 0,
                    timestamp: new Date().toISOString()
                });
                logger_1.logger.info('WebSocket event emitted for new product', { productId: result.productId, productName: name });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event for new product', { error: error instanceof Error ? error.message : String(error) });
        }
        const responseMessage = result.nameModified
            ? `Product added successfully. Name was modified from "${result.originalName}" to "${result.finalName}" to avoid conflicts.`
            : 'Product added successfully';
        res.json({
            message: responseMessage,
            productId: result.productId,
            originalName: result.originalName,
            finalName: result.finalName,
            nameModified: result.nameModified
        });
    }
    catch (error) {
        console.error('Error adding product:', error);
        logger_1.logger.error('Error adding product - DETAILED', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && error.message.includes('already exists') ? 409 :
            error instanceof Error && error.message.includes('not found') ? 401 :
                error instanceof Error && error.message.includes('required') ? 400 : 500;
        res.status(statusCode).json({
            message: error instanceof Error ? error.message : 'Failed to add product',
            error: error instanceof Error ? error.message : String(error)
        });
    }
    finally {
        client.release();
    }
});
// Update product stock manually
router.patch('/:id/stock', validation_2.validateQuantity, async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { quantity } = req.body;
        const result = await (0, inventoryService_1.updateStockService)(client, req.session.userId, parseInt(id), quantity);
        // Emit WebSocket event to notify frontend about stock update
        try {
            const io = global.io;
            if (io) {
                io.emit('inventory-stock-updated', {
                    productId: parseInt(id),
                    quantity: quantity,
                    timestamp: new Date().toISOString()
                });
                logger_1.logger.info('WebSocket event emitted for stock update', { productId: id, quantity });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event for stock update', { error: error instanceof Error ? error.message : String(error) });
        }
        res.json({ message: 'Product stock updated successfully :', product: result });
    }
    catch (error) {
        logger_1.logger.error('Error updating product stock manually', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
            error instanceof Error && error.message.includes('Valid') ? 400 : 500;
        res.status(statusCode).json({ message: error instanceof Error ? error.message : 'Failed to update product stock' });
    }
    finally {
        client.release();
    }
});
// Update product (both name and stock)
router.patch('/:id/update', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { productName, brand, description, quantity, reorderLevel, hsn_code, gst_rate } = req.body;
        await (0, inventoryService_1.updateProductAndInventoryService)(client, req.session.userId, parseInt(id), {
            productName,
            brand,
            description,
            quantity,
            reorderLevel,
            hsn_code,
            gst_rate
        });
        // Invalidate user cache after update
        (0, cache_1.invalidateUserCache)(req.session.userId);
        // Emit WebSocket event to notify frontend about inventory update
        try {
            const io = global.io;
            if (io) {
                io.emit('inventory-updated', {
                    productId: parseInt(id),
                    productName: productName,
                    quantity: quantity,
                    reorderLevel: reorderLevel,
                    brand: brand,
                    description: description,
                    hsn_code: hsn_code,
                    gst_rate: gst_rate,
                    timestamp: new Date().toISOString()
                });
                logger_1.logger.info('WebSocket event emitted for inventory update', { productId: id });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event for inventory update', { error: error instanceof Error ? error.message : String(error) });
        }
        res.json({ message: 'Product updated successfully' });
    }
    catch (error) {
        logger_1.logger.error('Error updating product', error instanceof Error ? error.message : String(error));
        const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({ message: error instanceof Error ? error.message : 'Failed to update product' });
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=inventory.js.map
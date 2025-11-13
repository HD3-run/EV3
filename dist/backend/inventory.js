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
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const router = (0, express_1.Router)();
// Helper function to check for product duplicates and handle name conflicts
async function checkProductDuplicate(client, merchantId, name, brand) {
    // First check for exact duplicate (same name AND same brand)
    const exactDuplicate = await client.query('SELECT product_id, product_name, brand FROM oms.products WHERE merchant_id = $1 AND product_name = $2 AND (brand = $3 OR (brand IS NULL AND $3 IS NULL))', [merchantId, name, brand || null]);
    if (exactDuplicate.rows.length > 0) {
        return {
            isDuplicate: true,
            existingProduct: exactDuplicate.rows[0]
        };
    }
    // Check if there's a name conflict with different brand
    const nameConflict = await client.query('SELECT product_id, product_name, brand FROM oms.products WHERE merchant_id = $1 AND product_name = $2', [merchantId, name]);
    if (nameConflict.rows.length > 0 && brand) {
        // There's a name conflict but different brand - modify the name to include brand
        const modifiedName = `${name} (${brand})`;
        // Check if the modified name also exists
        const modifiedConflict = await client.query('SELECT product_id, product_name, brand FROM oms.products WHERE merchant_id = $1 AND product_name = $2', [merchantId, modifiedName]);
        if (modifiedConflict.rows.length === 0) {
            return {
                isDuplicate: false,
                modifiedName: modifiedName
            };
        }
    }
    return {
        isDuplicate: false
    };
}
// Get all products with pagination and filtering
router.get('/', validation_2.validatePagination, (0, cache_1.cacheMiddleware)(60), async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { page = 1, limit = 20, category, search, lowStock, stockStatus } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        // Allow unlimited products to be loaded
        const limitNum = Number(limit) || 20;
        console.log('🔍 Inventory API - Request params:', { page, limit, category, search, lowStock, stockStatus });
        console.log('👤 Session userId:', req.session?.userId);
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        console.log('👤 User lookup result:', userResult.rows);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        console.log('🏪 Merchant ID:', merchantId);
        // Optimized query with proper joins and indexes
        let query = `
      SELECT p.product_id, p.merchant_id, p.product_name, p.sku, p.description, p.category, p.brand, p.hsn_code, p.gst_rate, p.created_at,
             i.quantity_available, i.reorder_level, i.cost_price as unit_price,
             (i.quantity_available <= i.reorder_level) as is_low_stock,
             COUNT(*) OVER() as total_count
      FROM oms.products p
      INNER JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = $1
    `;
        const params = [merchantId];
        let paramIndex = 2;
        if (category && category !== 'all') {
            query += ` AND p.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        if (search) {
            // Search by product_name, sku, or product_id
            query += ` AND (
        p.product_name ILIKE $${paramIndex} OR 
        p.sku ILIKE $${paramIndex + 1} OR 
        p.product_id::text ILIKE $${paramIndex + 2}
      )`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            paramIndex += 3;
        }
        if (lowStock === 'true') {
            query += ` AND i.quantity_available <= i.reorder_level`;
        }
        if (stockStatus === 'low') {
            query += ` AND i.quantity_available <= i.reorder_level`;
        }
        else if (stockStatus === 'in') {
            query += ` AND i.quantity_available > i.reorder_level`;
        }
        query += ` ORDER BY p.product_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limitNum, offset);
        console.log('🔍 SQL Query:', query);
        console.log('🔍 SQL Params:', params);
        const result = await client.query(query, params);
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
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        // Check for duplicate SKU within merchant
        if (sku) {
            const existingSku = await client.query('SELECT product_id FROM oms.products WHERE merchant_id = $1 AND sku = $2', [merchantId, sku]);
            if (existingSku.rows.length > 0) {
                return res.status(409).json({ message: 'SKU already exists for this merchant' });
            }
        }
        const result = await client.query(`
      INSERT INTO oms.products (merchant_id, product_name, sku, description, category, hsn_code, gst_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [merchantId, name, sku, description, category, hsn_code || null, gst_rate || 18.00]);
        // Invalidate cache after creating product
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.status(201).json({
            message: 'Product created successfully',
            product: result.rows[0]
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating product', error instanceof Error ? error.message : String(error));
        res.status(500).json({
            message: 'Failed to create product',
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
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        const result = await client.query(`
      UPDATE oms.products 
      SET product_name = $1, sku = $2, description = $3, category = $4, hsn_code = $5, gst_rate = $6, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $7 AND merchant_id = $8
      RETURNING *
    `, [name, sku, description, category, hsn_code || null, gst_rate || 18.00, id, merchantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        logger_1.logger.error('Error updating product', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update product' });
    }
    finally {
        client.release();
    }
});
// Get low stock products
router.get('/low-stock', (0, cache_1.cacheMiddleware)(30), async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        const result = await client.query(`
      SELECT p.product_id, p.merchant_id, p.product_name, p.sku, p.description, p.category, p.brand, p.hsn_code, p.gst_rate, p.created_at,
             i.quantity_available, i.reorder_level, i.cost_price as unit_price,
             (i.quantity_available <= i.reorder_level) as is_low_stock
      FROM oms.products p 
      JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = $1 AND i.quantity_available <= i.reorder_level
      ORDER BY i.quantity_available ASC
    `, [merchantId]);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(result.rows);
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
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        await client.query('BEGIN');
        const { updates } = req.body;
        const results = [];
        for (const update of updates) {
            const result = await client.query(`
        UPDATE oms.inventory 
        SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP
        WHERE sku = $2 AND merchant_id = $3
        RETURNING *
      `, [update.stockQuantity, update.sku, merchantId]);
            if (result.rows.length > 0) {
                results.push(result.rows[0]);
            }
        }
        await client.query('COMMIT');
        // Invalidate user cache immediately after commit to ensure fresh data
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({ message: `${results.length} products updated successfully`, products: results });
    }
    catch (error) {
        await client.query('ROLLBACK');
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
    // Use uploadId from request if provided, otherwise generate one
    const uploadId = req.body.uploadId || `stock_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        if (!req.file) {
            logger_1.logger.error('No file uploaded for stock update');
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        logger_1.logger.info('User lookup for stock update CSV', { userFound: userResult.rows.length > 0, userId: req.session.userId });
        if (userResult.rows.length === 0) {
            logger_1.logger.error('User not found for stock update CSV', { userId: req.session.userId });
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        logger_1.logger.info('Processing stock update CSV for merchant', { merchantId });
        const products = [];
        const errors = [];
        const updatedProducts = [];
        const stream = stream_1.Readable.from(req.file.buffer.toString());
        await new Promise((resolve, reject) => {
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                try {
                    const product = {
                        name: row.product_name || row['Product Name'],
                        sku: row.sku || row['SKU'],
                        brand: row.brand || row['Brand'] || '',
                        description: row.description || row['Description'] || '',
                        stock: parseInt(row.stock || row['Stock']) || 0
                    };
                    if (!product.name && !product.sku) {
                        errors.push(`Missing product name and SKU in row: ${JSON.stringify(row)}`);
                        return;
                    }
                    if (product.stock < 0) {
                        errors.push(`Invalid stock quantity (${product.stock}) in row: ${JSON.stringify(row)}`);
                        return;
                    }
                    products.push(product);
                }
                catch (error) {
                    errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
                }
            })
                .on('end', resolve)
                .on('error', reject);
        });
        if (products.length === 0) {
            return res.status(400).json({ message: 'No valid products found in CSV', errors });
        }
        await client.query('BEGIN');
        // Emit initial progress
        if (global.io) {
            global.io.emit('csv-upload-progress', {
                uploadId,
                progress: 0,
                currentItem: 'Starting stock update...',
                totalItems: products.length,
                processedItems: 0,
                errors: [],
                completed: false
            });
        }
        for (let i = 0; i < products.length; i++) {
            const productData = products[i];
            try {
                logger_1.logger.info('Processing stock update from CSV', { productData });
                // Emit progress update
                if (global.io) {
                    global.io.emit('csv-upload-progress', {
                        uploadId,
                        progress: Math.round((i / products.length) * 100),
                        currentItem: productData.name || productData.sku,
                        totalItems: products.length,
                        processedItems: i,
                        errors: [...errors],
                        completed: false
                    });
                }
                let updateResult;
                // Try to update by product name first
                if (productData.name) {
                    updateResult = await client.query('UPDATE oms.inventory SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP WHERE merchant_id = $2 AND product_id IN (SELECT product_id FROM oms.products WHERE product_name = $3 AND merchant_id = $2) RETURNING *', [productData.stock, merchantId, productData.name]);
                }
                else {
                    // Update by SKU
                    updateResult = await client.query('UPDATE oms.inventory SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP WHERE sku = $2 AND merchant_id = $3 RETURNING *', [productData.stock, productData.sku, merchantId]);
                }
                if (updateResult.rows.length > 0) {
                    logger_1.logger.info('Stock updated from CSV', { productId: updateResult.rows[0].product_id, newStock: productData.stock });
                    updatedProducts.push({ productId: updateResult.rows[0].product_id, sku: updateResult.rows[0].sku, newStock: productData.stock });
                }
                else {
                    errors.push(`Product not found: ${productData.name || productData.sku}`);
                }
            }
            catch (error) {
                console.error('Error updating stock from CSV:', error);
                logger_1.logger.error('Error updating stock from CSV', error instanceof Error ? error.message : String(error));
                errors.push(`Error updating stock for ${productData.name || productData.sku}: ${String(error)}`);
            }
        }
        await client.query('COMMIT');
        logger_1.logger.info('Stock update CSV processing completed', {
            totalParsed: products.length,
            updated: updatedProducts.length,
            errors: errors.length
        });
        // Emit final progress/completion event
        if (global.io) {
            global.io.emit('csv-upload-progress', {
                uploadId,
                progress: 100,
                currentItem: 'Stock update completed!',
                totalItems: products.length,
                processedItems: products.length,
                errors: [...errors],
                completed: true,
                successMessage: `Successfully updated stock for ${updatedProducts.length} products${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
            });
        }
        // Invalidate user cache immediately after commit to ensure fresh data
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({
            message: `Successfully updated stock for ${updatedProducts.length} products`,
            updated: updatedProducts.length,
            errors: errors.length,
            errorDetails: errors,
            uploadId
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing stock update CSV upload:', error);
        logger_1.logger.error('Error processing stock update CSV upload - DETAILED', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to process CSV upload', error: error instanceof Error ? error.message : String(error) });
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
    // Use uploadId from request if provided, otherwise generate one
    const uploadId = req.body.uploadId || `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        if (!req.file) {
            logger_1.logger.error('No file uploaded');
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        logger_1.logger.info('User lookup for CSV upload', { userFound: userResult.rows.length > 0, userId: req.session.userId });
        if (userResult.rows.length === 0) {
            logger_1.logger.error('User not found for CSV upload', { userId: req.session.userId });
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        logger_1.logger.info('Processing CSV for merchant', { merchantId });
        const products = [];
        const errors = [];
        const createdProducts = [];
        const stream = stream_1.Readable.from(req.file.buffer.toString());
        await new Promise((resolve, reject) => {
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                try {
                    const product = {
                        name: row.product_name || row['Product Name'],
                        category: row.category || row['Category'],
                        brand: row.brand || row['Brand'] || '',
                        description: row.description || row['Description'] || '',
                        stock: parseInt(row.stock_quantity || row['Stock Quantity']) || 0,
                        reorderLevel: parseInt(row.reorder_level || row['Reorder Level']) || 0,
                        unitPrice: parseFloat(row.unit_price || row['Unit Price']) || 0,
                        hsn_code: row.hsn_code || row['HSN Code'] || null,
                        gst_rate: parseFloat(row.gst_rate || row['GST Rate']) || 18.00
                    };
                    if (!product.name) {
                        errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
                        return;
                    }
                    products.push(product);
                }
                catch (error) {
                    errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
                }
            })
                .on('end', resolve)
                .on('error', reject);
        });
        if (products.length === 0) {
            return res.status(400).json({ message: 'No valid products found in CSV', errors });
        }
        await client.query('BEGIN');
        // Emit initial progress
        if (global.io) {
            const connectedClients = global.io.sockets.sockets.size;
            console.log('Emitting initial progress event for upload:', uploadId, 'to', connectedClients, 'connected clients');
            if (connectedClients === 0) {
                console.log('⚠️ No connected clients - WebSocket connection may have dropped');
                console.log('⚠️ This means the frontend WebSocket connection was lost');
                console.log('⚠️ Progress events will be emitted but not received by frontend');
            }
            else {
                console.log('✅ WebSocket connection is active, progress events will be delivered');
            }
            const initialProgressData = {
                uploadId,
                progress: 0,
                currentItem: 'Starting upload...',
                totalItems: products.length,
                processedItems: 0,
                errors: [],
                completed: false
            };
            console.log('Initial progress data:', initialProgressData);
            global.io.emit('csv-upload-progress', initialProgressData);
        }
        else {
            console.log('❌ Global io not available for progress tracking');
        }
        // BATCH PROCESSING: Process products in batches of 500 for efficiency
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(products.length / BATCH_SIZE);
        logger_1.logger.info('Starting BATCH PROCESSING', {
            totalProducts: products.length,
            batchSize: BATCH_SIZE,
            totalBatches,
            merchantId
        });
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * BATCH_SIZE;
            const endIndex = Math.min(startIndex + BATCH_SIZE, products.length);
            const batch = products.slice(startIndex, endIndex);
            try {
                logger_1.logger.info('Processing batch', {
                    batchIndex: batchIndex + 1,
                    totalBatches,
                    batchSize: batch.length,
                    startIndex,
                    endIndex
                });
                // Emit batch progress update
                if (global.io) {
                    const progressData = {
                        uploadId,
                        progress: Math.round((startIndex / products.length) * 100),
                        currentItem: `Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`,
                        totalItems: products.length,
                        processedItems: startIndex,
                        errors: [...errors],
                        completed: false,
                        batchProcessing: true,
                        currentBatch: batchIndex + 1,
                        totalBatches,
                        batchSize: batch.length
                    };
                    console.log('Emitting batch progress update:', progressData);
                    global.io.emit('csv-upload-progress', progressData);
                }
                // Process entire batch in a single transaction
                await client.query('BEGIN');
                // OPTIMIZED: Batch insert products with conflict handling
                const productValues = batch.map((_, index) => `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`).join(', ');
                const productParams = batch.flatMap(product => [
                    merchantId,
                    product.name,
                    product.category || 'Uncategorized',
                    product.brand || null,
                    product.description || null,
                    product.hsn_code || null,
                    product.gst_rate || 18.00
                ]);
                const productQuery = `
          INSERT INTO oms.products (merchant_id, product_name, category, brand, description, hsn_code, gst_rate) 
          VALUES ${productValues} 
          ON CONFLICT (merchant_id, product_name) DO UPDATE SET
            category = EXCLUDED.category,
            brand = EXCLUDED.brand,
            description = EXCLUDED.description,
            hsn_code = EXCLUDED.hsn_code,
            gst_rate = EXCLUDED.gst_rate,
            updated_at = CURRENT_TIMESTAMP
          RETURNING product_id, sku, product_name
        `;
                const productResults = await client.query(productQuery, productParams);
                // Batch insert inventory records
                const inventoryValues = productResults.rows.map((_, index) => `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`).join(', ');
                const inventoryParams = productResults.rows.flatMap((product, index) => [
                    merchantId,
                    product.product_id,
                    product.sku,
                    batch[index].stock || 0,
                    batch[index].reorderLevel || 0,
                    batch[index].unitPrice || 0
                ]);
                const inventoryQuery = `
          INSERT INTO oms.inventory (merchant_id, product_id, sku, quantity_available, reorder_level, cost_price) 
          VALUES ${inventoryValues}
          RETURNING *
        `;
                const inventoryResults = await client.query(inventoryQuery, inventoryParams);
                // Commit batch transaction
                await client.query('COMMIT');
                // Add successful results
                createdProducts.push(...inventoryResults.rows.map((_, index) => ({
                    productId: productResults.rows[index].product_id,
                    sku: productResults.rows[index].sku,
                    name: productResults.rows[index].product_name,
                    ...batch[index]
                })));
                logger_1.logger.info('Batch processed successfully', {
                    batchIndex: batchIndex + 1,
                    batchSize: batch.length,
                    totalProcessed: createdProducts.length
                });
                // Emit batch completion progress
                if (global.io) {
                    const progressData = {
                        uploadId,
                        progress: Math.round((endIndex / products.length) * 100),
                        currentItem: `Completed batch ${batchIndex + 1}/${totalBatches}`,
                        totalItems: products.length,
                        processedItems: endIndex,
                        errors: [...errors],
                        completed: false,
                        batchProcessing: true,
                        currentBatch: batchIndex + 1,
                        totalBatches,
                        batchSize: batch.length
                    };
                    global.io.emit('csv-upload-progress', progressData);
                }
            }
            catch (error) {
                // Rollback batch transaction on error
                await client.query('ROLLBACK');
                console.error('Error processing batch:', error);
                logger_1.logger.error('Error processing batch', {
                    batchIndex: batchIndex + 1,
                    error: error instanceof Error ? error.message : String(error)
                });
                // Add individual items from failed batch to errors
                batch.forEach((product) => {
                    errors.push(`Error creating product ${product.name}: ${String(error)}`);
                });
            }
        }
        await client.query('COMMIT');
        logger_1.logger.info('CSV processing completed', {
            totalParsed: products.length,
            created: createdProducts.length,
            errors: errors.length
        });
        // Emit final progress/completion event
        if (global.io) {
            console.log('Emitting final completion event for upload:', uploadId);
            const finalProgressData = {
                uploadId,
                progress: 100,
                currentItem: 'Upload completed!',
                totalItems: products.length,
                processedItems: products.length,
                errors: [...errors],
                completed: true,
                successMessage: `Successfully processed ${createdProducts.length} products${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
            };
            console.log('Final progress data:', finalProgressData);
            console.log('Connected clients for final event:', global.io.sockets.sockets.size);
            global.io.emit('csv-upload-progress', finalProgressData);
        }
        else {
            console.log('❌ Global io not available for final progress event');
        }
        // Trigger inventory reload by logging completion
        logger_1.logger.info('CSV upload completed - inventory should be refreshed');
        // Invalidate user cache immediately after commit to ensure fresh data
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({
            message: `Successfully processed ${createdProducts.length} products using BATCH PROCESSING`,
            created: createdProducts.length,
            errors: errors.length,
            errorDetails: errors,
            uploadId,
            batchProcessing: true,
            totalBatches,
            batchSize: BATCH_SIZE,
            processingMethod: 'Batch Processing (500 items per batch)'
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing inventory CSV upload:', error);
        logger_1.logger.error('Error processing inventory CSV upload - DETAILED', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to process CSV upload', error: error instanceof Error ? error.message : String(error) });
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
        if (unitPrice === undefined || unitPrice < 0) {
            return res.status(400).json({ message: 'Valid unit price is required' });
        }
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        const result = await client.query('UPDATE oms.inventory SET cost_price = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 AND merchant_id = $3 RETURNING *', [unitPrice, id, merchantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
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
        res.status(500).json({ message: 'Failed to update cost price' });
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
        const { name, category, brand, description, stock, reorderLevel, unitPrice, hsn_code, gst_rate } = req.body;
        logger_1.logger.info('Extracted request data', { name, category, stock, reorderLevel, unitPrice });
        if (!name) {
            logger_1.logger.error('Missing required field: name');
            return res.status(400).json({ message: 'Product name is required' });
        }
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        logger_1.logger.info('User lookup result', { userFound: userResult.rows.length > 0, userId: req.session.userId });
        if (userResult.rows.length === 0) {
            logger_1.logger.error('User not found in database', { userId: req.session.userId });
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        logger_1.logger.info('Found merchant', { merchantId });
        await client.query('BEGIN');
        logger_1.logger.info('Transaction started');
        // Check for duplicates and handle name conflicts
        const duplicateCheck = await checkProductDuplicate(client, merchantId, name, brand || null);
        if (duplicateCheck.isDuplicate) {
            await client.query('ROLLBACK');
            const existingBrand = duplicateCheck.existingProduct?.brand || 'No Brand';
            logger_1.logger.warn('Exact duplicate product found', {
                existingProduct: duplicateCheck.existingProduct,
                newProduct: { name, brand, category },
                message: `Product "${name}" with brand "${existingBrand}" already exists. Please use a different name or brand.`
            });
            return res.status(409).json({
                message: `Product "${name}" with brand "${existingBrand}" already exists. Please use a different name or brand.`,
                existingProduct: duplicateCheck.existingProduct
            });
        }
        // Use modified name if there was a name conflict with different brand
        const finalProductName = duplicateCheck.modifiedName || name;
        // Create product (database will auto-generate SKU)
        logger_1.logger.info('Creating product', { merchantId, originalName: name, finalName: finalProductName, category, brand, description, hsn_code, gst_rate });
        const productResult = await client.query('INSERT INTO oms.products (merchant_id, product_name, category, brand, description, hsn_code, gst_rate) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING product_id, sku', [merchantId, finalProductName, category, brand || null, description || null, hsn_code || null, gst_rate || 18.00]);
        const productId = productResult.rows[0].product_id;
        const sku = productResult.rows[0].sku; // Fetch auto-generated SKU from database
        logger_1.logger.info('Product created', { productId, sku });
        // Create inventory record
        logger_1.logger.info('Creating inventory record', { merchantId, productId, sku, stock, reorderLevel, unitPrice });
        await client.query('INSERT INTO oms.inventory (merchant_id, product_id, sku, quantity_available, reorder_level, cost_price) VALUES ($1, $2, $3, $4, $5, $6)', [merchantId, productId, sku, stock, reorderLevel, unitPrice || 0]);
        await client.query('COMMIT');
        logger_1.logger.info('Transaction committed successfully');
        logger_1.logger.info('Manual product addition completed - inventory should be refreshed');
        // Invalidate user cache immediately after commit
        (0, cache_1.invalidateUserCache)(req.session.userId);
        // Emit WebSocket event to notify frontend about new product
        try {
            const io = global.io;
            if (io) {
                io.emit('inventory-product-added', {
                    productId: productId,
                    productName: name,
                    sku: sku,
                    category: category,
                    brand: brand,
                    description: description,
                    stock: stock,
                    reorderLevel: reorderLevel,
                    unitPrice: unitPrice || 0,
                    timestamp: new Date().toISOString()
                });
                logger_1.logger.info('WebSocket event emitted for new product', { productId, productName: name });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event for new product', { error: error instanceof Error ? error.message : String(error) });
        }
        const responseMessage = finalProductName !== name
            ? `Product added successfully. Name was modified from "${name}" to "${finalProductName}" to avoid conflicts.`
            : 'Product added successfully';
        res.json({
            message: responseMessage,
            productId,
            originalName: name,
            finalName: finalProductName,
            nameModified: finalProductName !== name
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding product:', error);
        logger_1.logger.error('Error adding product - DETAILED', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to add product', error: error instanceof Error ? error.message : String(error) });
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
        if (quantity === undefined || quantity < 0) {
            return res.status(400).json({ message: 'Valid quantity is required' });
        }
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        const result = await client.query('UPDATE oms.inventory SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 AND merchant_id = $3 RETURNING *', [quantity, id, merchantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found or not associated with your merchant' });
        }
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
        res.json({ message: 'Product stock updated successfully :', product: result.rows[0] });
    }
    catch (error) {
        logger_1.logger.error('Error updating product stock manually', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update product stock' });
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
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        await client.query('BEGIN');
        // Update product details if provided
        if (productName || brand !== undefined || description !== undefined || hsn_code !== undefined || gst_rate !== undefined) {
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;
            if (productName) {
                updateFields.push(`product_name = $${paramIndex++}`);
                updateValues.push(productName);
            }
            if (brand !== undefined) {
                updateFields.push(`brand = $${paramIndex++}`);
                updateValues.push(brand || null);
            }
            if (description !== undefined) {
                updateFields.push(`description = $${paramIndex++}`);
                updateValues.push(description || null);
            }
            if (hsn_code !== undefined) {
                updateFields.push(`hsn_code = $${paramIndex++}`);
                updateValues.push(hsn_code || null);
            }
            if (gst_rate !== undefined) {
                updateFields.push(`gst_rate = $${paramIndex++}`);
                updateValues.push(gst_rate || 18.00);
            }
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            updateValues.push(id, merchantId);
            const productResult = await client.query(`UPDATE oms.products SET ${updateFields.join(', ')} WHERE product_id = $${paramIndex++} AND merchant_id = $${paramIndex++} RETURNING *`, updateValues);
            if (productResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Product not found or not associated with your merchant' });
            }
        }
        // Update stock if provided
        if (quantity !== undefined && quantity >= 0) {
            const inventoryResult = await client.query('UPDATE oms.inventory SET quantity_available = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 AND merchant_id = $3 RETURNING *', [quantity, id, merchantId]);
            if (inventoryResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Product inventory not found or not associated with your merchant' });
            }
        }
        // Update reorder level if provided
        if (reorderLevel !== undefined && reorderLevel >= 0) {
            const reorderResult = await client.query('UPDATE oms.inventory SET reorder_level = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2 AND merchant_id = $3 RETURNING *', [reorderLevel, id, merchantId]);
            if (reorderResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Product inventory not found or not associated with your merchant' });
            }
        }
        await client.query('COMMIT');
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
        await client.query('ROLLBACK');
        logger_1.logger.error('Error updating product', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update product' });
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=inventory.js.map
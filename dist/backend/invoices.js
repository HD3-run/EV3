"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("./db");
const logger_1 = require("./utils/logger");
const constants_1 = require("./utils/constants");
const multer_1 = __importDefault(require("multer"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const pdfkit_1 = __importDefault(require("pdfkit"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const router = (0, express_1.Router)();
// Helper function to generate invoice number
async function generateInvoiceNumber(merchantId) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Get and increment next_invoice_number atomically
        const result = await client.query(`UPDATE oms.merchant_billing_details 
       SET next_invoice_number = next_invoice_number + 1 
       WHERE merchant_id = $1 
       RETURNING next_invoice_number, invoice_prefix`, [merchantId]);
        if (result.rows.length === 0) {
            throw new Error('Merchant billing details not found. Please set up billing details first.');
        }
        await client.query('COMMIT');
        return {
            invoiceNumber: result.rows[0].next_invoice_number,
            invoicePrefix: result.rows[0].invoice_prefix || 'INV-'
        };
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
// Helper function to create invoice from order
async function createInvoiceFromOrder(orderId, merchantId, dueDate, notes, taxAmount = 0, discountAmount = 0) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Get order details with customer state
        const orderResult = await client.query(`SELECT o.order_id, o.total_amount, o.customer_id, o.status, c.state_code as customer_state_code
       FROM oms.orders o 
       LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
       WHERE o.order_id = $1 AND o.merchant_id = $2`, [orderId, merchantId]);
        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }
        const order = orderResult.rows[0];
        // Generate invoice number and get billing_id with merchant state
        const { invoiceNumber, invoicePrefix } = await generateInvoiceNumber(merchantId);
        // Get billing_id and merchant state from merchant billing details
        const billingResult = await client.query('SELECT billing_id, state_code FROM oms.merchant_billing_details WHERE merchant_id = $1', [merchantId]);
        if (billingResult.rows.length === 0) {
            throw new Error('Merchant billing details not found. Please set up billing details first.');
        }
        const billingId = billingResult.rows[0].billing_id;
        const merchantStateCode = billingResult.rows[0].state_code;
        const customerStateCode = order.customer_state_code;
        console.log('📋 GST Calculation Debug:', {
            merchantStateCode,
            customerStateCode,
            merchantStateCodeType: typeof merchantStateCode,
            customerStateCodeType: typeof customerStateCode,
            merchantStateCodeTrimmed: merchantStateCode?.toString().trim(),
            customerStateCodeTrimmed: customerStateCode?.toString().trim(),
            areEqual: merchantStateCode === customerStateCode,
            areEqualTrimmed: merchantStateCode?.toString().trim() === customerStateCode?.toString().trim()
        });
        // Get order items with product GST details
        const orderItemsResult = await client.query(`SELECT oi.order_item_id, oi.product_id, oi.inventory_id, oi.quantity, oi.price_per_unit, oi.total_price,
              p.hsn_code, p.gst_rate
       FROM oms.order_items oi 
       LEFT JOIN oms.products p ON oi.product_id = p.product_id
       WHERE oi.order_id = $1`, [orderId]);
        // Calculate GST for each item
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let subtotal = 0;
        const itemsWithGst = orderItemsResult.rows.map((item) => {
            const itemTotal = parseFloat(item.total_price);
            const gstRate = parseFloat(item.gst_rate) || 18.00;
            // Calculate base amount (excluding GST) and GST amount
            const baseAmount = itemTotal / (1 + (gstRate / 100));
            const gstAmount = itemTotal - baseAmount;
            subtotal += baseAmount;
            // Determine if intra-state or inter-state (trim and compare as strings)
            const merchantState = merchantStateCode?.toString().trim();
            const customerState = customerStateCode?.toString().trim();
            const isIntraState = merchantState && customerState && merchantState === customerState;
            console.log('🔍 Item GST Check:', {
                merchantState,
                customerState,
                isIntraState,
                gstRate,
                gstAmount
            });
            let cgst = 0, sgst = 0, igst = 0;
            if (isIntraState) {
                // Intra-state: Split GST into CGST and SGST
                cgst = gstAmount / 2;
                sgst = gstAmount / 2;
                totalCgst += cgst;
                totalSgst += sgst;
            }
            else {
                // Inter-state: Use IGST
                igst = gstAmount;
                totalIgst += igst;
            }
            return {
                ...item,
                cgst_amount: cgst,
                sgst_amount: sgst,
                igst_amount: igst,
                gst_rate: gstRate
            };
        });
        const totalGst = totalCgst + totalSgst + totalIgst;
        const totalAmount = subtotal + totalGst - discountAmount;
        console.log('💰 GST Breakdown - CGST:', totalCgst.toFixed(2), 'SGST:', totalSgst.toFixed(2), 'IGST:', totalIgst.toFixed(2), 'Total:', totalAmount.toFixed(2));
        // Create invoice header with GST breakdown
        const invoiceResult = await client.query(`INSERT INTO oms.invoices 
       (invoice_number, order_id, merchant_id, billing_id, invoice_date, due_date, 
        subtotal, tax_amount, discount_amount, total_amount, cgst_amount, sgst_amount, igst_amount, payment_status, notes)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8, $9, $10, $11, $12, 'unpaid', $13)
       RETURNING *`, [invoiceNumber, orderId, merchantId, billingId, dueDate,
            subtotal, totalGst, discountAmount, totalAmount, totalCgst, totalSgst, totalIgst, notes]);
        const invoice = invoiceResult.rows[0];
        // Insert invoice items with GST breakdown
        for (const item of itemsWithGst) {
            await client.query(`INSERT INTO oms.invoice_items 
         (invoice_id, order_item_id, product_id, inventory_id, quantity, unit_price, total_amount, 
          hsn_code, gst_rate, cgst_amount, sgst_amount, igst_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [invoice.invoice_id, item.order_item_id, item.product_id, item.inventory_id,
                item.quantity, item.price_per_unit, item.total_price,
                item.hsn_code, item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount]);
        }
        await client.query('COMMIT');
        return {
            invoice,
            invoicePrefix,
            displayNumber: `${invoicePrefix}${invoiceNumber}`
        };
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
// Get all invoices with pagination
router.get('/', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { page = 1, limit = 50, search, status } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const limitNum = Number(limit);
        const userResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const { merchant_id: merchantId } = userResult.rows[0];
        let whereClause = 'WHERE i.merchant_id = $1';
        const queryParams = [merchantId];
        let paramCount = 1;
        if (search) {
            paramCount++;
            whereClause += ` AND c.name ILIKE $${paramCount}`;
            queryParams.push(`%${search}%`);
        }
        if (status && status !== 'all') {
            paramCount++;
            whereClause += ` AND i.payment_status = $${paramCount}`;
            queryParams.push(status);
        }
        const query = `
      SELECT 
        i.invoice_id, 
        i.invoice_number, 
        i.order_id, 
        i.invoice_date, 
        i.due_date,
        i.subtotal, 
        i.tax_amount, 
        i.discount_amount, 
        i.total_amount,
        i.payment_status, 
        i.payment_method, 
        i.pdf_url, 
        i.notes,
        i.created_at,
        i.updated_at,
        c.name as customer_name, 
        o.status as order_status,
        mbd.invoice_prefix,
        COUNT(*) OVER() as total_count
      FROM oms.invoices i
      LEFT JOIN oms.orders o ON i.order_id = o.order_id
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      LEFT JOIN oms.merchant_billing_details mbd ON i.merchant_id = mbd.merchant_id
      ${whereClause}
      ORDER BY i.invoice_date DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
        queryParams.push(limitNum, offset);
        const result = await client.query(query, queryParams);
        const invoices = result.rows.map(row => ({
            invoice_id: row.invoice_id,
            invoice_number: row.invoice_number,
            invoice_prefix: row.invoice_prefix || 'INV-',
            display_number: `${row.invoice_prefix || 'INV-'}${row.invoice_number}`,
            order_id: row.order_id,
            invoice_date: row.invoice_date,
            due_date: row.due_date,
            subtotal: parseFloat(row.subtotal) || 0,
            tax_amount: parseFloat(row.tax_amount) || 0,
            discount_amount: parseFloat(row.discount_amount) || 0,
            total_amount: parseFloat(row.total_amount) || 0,
            payment_status: row.payment_status,
            payment_method: row.payment_method,
            pdf_url: row.pdf_url,
            notes: row.notes,
            customer_name: row.customer_name || 'Unknown Customer',
            order_status: row.order_status,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));
        res.json({
            invoices,
            pagination: {
                page: Number(page),
                limit: limitNum,
                total: result.rows[0]?.total_count || 0,
                totalPages: Math.ceil((result.rows[0]?.total_count || 0) / limitNum)
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching invoices', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to fetch invoices' });
    }
    finally {
        client.release();
    }
});
// Create manual invoice
router.post('/add-manual', async (req, res) => {
    try {
        const { orderId, dueDate, notes, discountAmount = 0 } = req.body;
        if (!orderId || !dueDate) {
            return res.status(400).json({ message: 'Order ID and due date are required' });
        }
        // Get user info from session
        const userResult = await db_1.pool.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        // Parse order ID - handle both numeric and "ORD123" format
        let numericOrderId;
        if (typeof orderId === 'string' && orderId.startsWith('ORD')) {
            numericOrderId = parseInt(orderId.replace('ORD', ''), 10);
        }
        else {
            numericOrderId = parseInt(orderId, 10);
        }
        if (isNaN(numericOrderId)) {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        // Create invoice using helper function (GST calculated automatically)
        const result = await createInvoiceFromOrder(numericOrderId, merchantId, dueDate, notes, 0, // taxAmount - ignored, GST calculated from products
        parseFloat(discountAmount) || 0);
        logger_1.logger.info('Manual invoice created successfully', {
            invoiceId: result.invoice.invoice_id,
            invoiceNumber: result.invoice.invoice_number,
            displayNumber: result.displayNumber,
            orderId: numericOrderId,
            totalAmount: result.invoice.total_amount
        });
        // Emit WebSocket event to notify frontend about new invoice
        try {
            const io = global.io;
            if (io) {
                io.emit('invoice-created', {
                    invoiceId: result.invoice.invoice_id,
                    invoiceNumber: result.invoice.invoice_number,
                    displayNumber: result.displayNumber,
                    orderId: numericOrderId,
                    totalAmount: result.invoice.total_amount,
                    timestamp: new Date().toISOString()
                });
                logger_1.logger.info('WebSocket event emitted for invoice creation', { invoiceId: result.invoice.invoice_id });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event', { error: error instanceof Error ? error.message : String(error) });
        }
        res.status(201).json({
            message: 'Invoice created successfully',
            invoice: {
                invoice_id: result.invoice.invoice_id,
                invoice_number: result.invoice.invoice_number,
                invoice_prefix: result.invoicePrefix,
                display_number: result.displayNumber,
                order_id: numericOrderId,
                total_amount: result.invoice.total_amount,
                subtotal: result.invoice.subtotal,
                tax_amount: result.invoice.tax_amount,
                discount_amount: result.invoice.discount_amount,
                due_date: result.invoice.due_date,
                payment_status: result.invoice.payment_status
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating manual invoice', error instanceof Error ? error.message : String(error));
        res.status(500).json({
            message: 'Failed to create invoice',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});
// CSV upload for invoices
router.post('/upload-csv', upload.single('file'), async (req, res) => {
    logger_1.logger.info('POST /api/invoices/upload-csv - Request received', {
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
        // Get user info from session
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        logger_1.logger.info('User lookup for CSV upload', { userFound: userResult.rows.length > 0, userId: req.session.userId });
        if (userResult.rows.length === 0) {
            logger_1.logger.error('User not found for CSV upload', { userId: req.session.userId });
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        logger_1.logger.info('Processing CSV for merchant', { merchantId });
        const invoices = [];
        const errors = [];
        const createdInvoices = [];
        // Parse CSV
        const stream = stream_1.Readable.from(req.file.buffer.toString());
        await new Promise((resolve, reject) => {
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                try {
                    const invoice = {
                        orderId: parseInt(row.order_id || row['Order ID']) || 0,
                        dueDate: row.due_date || row['Due Date'],
                        notes: row.notes || row['Notes'] || '',
                        discountAmount: parseFloat(row.discount_amount || row['Discount Amount']) || 0
                    };
                    if (!invoice.orderId || !invoice.dueDate) {
                        errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
                        return;
                    }
                    invoices.push(invoice);
                }
                catch (error) {
                    errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
                }
            })
                .on('end', resolve)
                .on('error', reject);
        });
        if (invoices.length === 0) {
            return res.status(400).json({ message: 'No valid invoices found in CSV', errors });
        }
        // Emit initial progress event
        if (global.io) {
            const connectedClients = global.io.sockets.sockets.size;
            console.log('Emitting initial progress event for invoices upload:', uploadId, 'to', connectedClients, 'connected clients');
            if (connectedClients === 0) {
                console.log('⚠️ No connected clients - WebSocket connection may have dropped');
                console.log('⚠️ This means the frontend WebSocket connection was lost');
                console.log('⚠️ Progress events will be emitted but not received by frontend');
            }
            else {
                console.log('✅ WebSocket connection is active, progress events will be delivered');
            }
            const initialProgressData = {
                uploadId: uploadId,
                progress: 0,
                totalItems: invoices.length,
                processedItems: 0,
                currentItem: 'Starting invoice processing...',
                status: 'processing'
            };
            console.log('Initial progress data:', initialProgressData);
            global.io.emit('csv-upload-progress', initialProgressData);
        }
        else {
            console.log('❌ Global io not available for progress tracking');
        }
        await client.query('BEGIN');
        // BATCH PROCESSING: Process invoices in batches of 500 for efficiency
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(invoices.length / BATCH_SIZE);
        logger_1.logger.info('Starting BATCH PROCESSING for invoices', {
            totalInvoices: invoices.length,
            batchSize: BATCH_SIZE,
            totalBatches,
            merchantId
        });
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * BATCH_SIZE;
            const endIndex = Math.min(startIndex + BATCH_SIZE, invoices.length);
            const batch = invoices.slice(startIndex, endIndex);
            try {
                logger_1.logger.info('Processing invoices batch', {
                    batchIndex: batchIndex + 1,
                    totalBatches,
                    batchSize: batch.length,
                    startIndex,
                    endIndex
                });
                // Emit batch progress update
                if (global.io) {
                    const progressData = {
                        uploadId: uploadId,
                        progress: Math.round((startIndex / invoices.length) * 100),
                        currentItem: `Processing invoices batch ${batchIndex + 1}/${totalBatches} (${batch.length} invoices)`,
                        totalItems: invoices.length,
                        processedItems: startIndex,
                        errors: [...errors],
                        completed: false,
                        batchProcessing: true,
                        currentBatch: batchIndex + 1,
                        totalBatches,
                        batchSize: batch.length,
                        status: 'processing'
                    };
                    console.log('Emitting batch progress update:', progressData);
                    global.io.emit('csv-upload-progress', progressData);
                }
                // Process entire batch in a single transaction
                await client.query('BEGIN');
                const batchResults = [];
                for (const invoiceData of batch) {
                    try {
                        logger_1.logger.info('Processing invoice data in batch', { orderId: invoiceData.orderId, dueDate: invoiceData.dueDate });
                        // Create invoice using helper function (GST calculated automatically)
                        const result = await createInvoiceFromOrder(invoiceData.orderId, merchantId, invoiceData.dueDate, invoiceData.notes || '', 0, // taxAmount - ignored, GST calculated from products
                        parseFloat(invoiceData.discountAmount) || 0);
                        logger_1.logger.info('Created invoice', {
                            invoiceId: result.invoice.invoice_id,
                            invoiceNumber: result.invoice.invoice_number,
                            displayNumber: result.displayNumber,
                            orderId: invoiceData.orderId
                        });
                        batchResults.push(result.invoice);
                    }
                    catch (error) {
                        errors.push(`Error creating invoice for order ${invoiceData.orderId}: ${String(error)}`);
                    }
                }
                // Commit batch transaction
                await client.query('COMMIT');
                // Add successful results
                createdInvoices.push(...batchResults);
                logger_1.logger.info('Invoices batch processed successfully', {
                    batchIndex: batchIndex + 1,
                    batchSize: batch.length,
                    totalProcessed: createdInvoices.length
                });
                // Emit batch completion progress
                if (global.io) {
                    const progressData = {
                        uploadId: uploadId,
                        progress: Math.round((endIndex / invoices.length) * 100),
                        currentItem: `Completed invoices batch ${batchIndex + 1}/${totalBatches}`,
                        totalItems: invoices.length,
                        processedItems: endIndex,
                        errors: [...errors],
                        completed: false,
                        batchProcessing: true,
                        currentBatch: batchIndex + 1,
                        totalBatches,
                        batchSize: batch.length,
                        status: 'processing'
                    };
                    global.io.emit('csv-upload-progress', progressData);
                }
            }
            catch (error) {
                // Rollback batch transaction on error
                await client.query('ROLLBACK');
                console.error('Error processing invoices batch:', error);
                logger_1.logger.error('Error processing invoices batch', {
                    batchIndex: batchIndex + 1,
                    error: error instanceof Error ? error.message : String(error)
                });
                // Add individual items from failed batch to errors
                batch.forEach((invoiceData) => {
                    errors.push(`Error creating invoice for order ${invoiceData.orderId}: ${String(error)}`);
                });
            }
        }
        await client.query('COMMIT');
        // Emit final progress event
        if (global.io) {
            const finalProgressData = {
                uploadId: uploadId,
                progress: 100,
                totalItems: invoices.length,
                processedItems: invoices.length,
                currentItem: `Completed! Created ${createdInvoices.length} invoices`,
                status: 'completed',
                created: createdInvoices.length,
                errors: errors.length
            };
            console.log('Emitting final progress event:', finalProgressData);
            global.io.emit('csv-upload-progress', finalProgressData);
        }
        logger_1.logger.info('Invoice CSV processed', {
            totalRows: invoices.length,
            created: createdInvoices.length,
            errors: errors.length
        });
        res.json({
            message: `Successfully processed ${createdInvoices.length} invoices using BATCH PROCESSING`,
            created: createdInvoices.length,
            errors: errors.length,
            errorDetails: errors,
            uploadId: uploadId,
            batchProcessing: true,
            totalBatches,
            batchSize: BATCH_SIZE,
            processingMethod: 'Batch Processing (500 invoices per batch)'
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error processing invoice CSV upload', error instanceof Error ? error.message : String(error));
        // Emit error progress event
        if (global.io) {
            const errorProgressData = {
                uploadId: uploadId,
                progress: 0,
                totalItems: 0,
                processedItems: 0,
                currentItem: 'Upload failed',
                status: 'error',
                error: error instanceof Error ? error.message : String(error)
            };
            console.log('Emitting error progress event:', errorProgressData);
            global.io.emit('csv-upload-progress', errorProgressData);
        }
        res.status(500).json({ message: 'Failed to process CSV upload', error: error instanceof Error ? error.message : String(error) });
    }
    finally {
        client.release();
    }
});
// Get invoice details with items
router.get('/:id/items', async (req, res) => {
    const { id } = req.params;
    const client = await db_1.pool.connect();
    try {
        // Get user info
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        // Get invoice header
        const invoiceResult = await client.query(`SELECT i.*, mbd.invoice_prefix, c.name as customer_name, o.status as order_status
       FROM oms.invoices i
       LEFT JOIN oms.merchant_billing_details mbd ON i.merchant_id = mbd.merchant_id
       LEFT JOIN oms.orders o ON i.order_id = o.order_id
       LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
       WHERE i.invoice_id = $1 AND i.merchant_id = $2`, [id, merchantId]);
        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        // Get invoice items
        const itemsResult = await client.query(`SELECT ii.*, p.name as product_name, p.sku
       FROM oms.invoice_items ii
       LEFT JOIN oms.products p ON ii.product_id = p.product_id
       WHERE ii.invoice_id = $1`, [id]);
        const invoice = invoiceResult.rows[0];
        res.json({
            invoice: {
                invoice_id: invoice.invoice_id,
                invoice_number: invoice.invoice_number,
                invoice_prefix: invoice.invoice_prefix || 'INV-',
                display_number: `${invoice.invoice_prefix || 'INV-'}${invoice.invoice_number}`,
                order_id: invoice.order_id,
                invoice_date: invoice.invoice_date,
                due_date: invoice.due_date,
                subtotal: parseFloat(invoice.subtotal) || 0,
                tax_amount: parseFloat(invoice.tax_amount) || 0,
                discount_amount: parseFloat(invoice.discount_amount) || 0,
                total_amount: parseFloat(invoice.total_amount) || 0,
                payment_status: invoice.payment_status,
                payment_method: invoice.payment_method,
                pdf_url: invoice.pdf_url,
                notes: invoice.notes,
                customer_name: invoice.customer_name,
                order_status: invoice.order_status,
                created_at: invoice.created_at,
                updated_at: invoice.updated_at
            },
            items: itemsResult.rows.map(item => ({
                invoice_item_id: item.invoice_item_id,
                order_item_id: item.order_item_id,
                product_id: item.product_id,
                inventory_id: item.inventory_id,
                product_name: item.product_name,
                sku: item.sku,
                quantity: parseFloat(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                tax_amount: parseFloat(item.tax_amount) || 0,
                discount_amount: parseFloat(item.discount_amount) || 0,
                total_amount: parseFloat(item.total_amount) || 0,
                created_at: item.created_at,
                updated_at: item.updated_at
            }))
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching invoice details', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to fetch invoice details' });
    }
    finally {
        client.release();
    }
});
// Update invoice status
router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { payment_status, payment_method } = req.body;
    const client = await db_1.pool.connect();
    try {
        // Get user info
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        // Validate payment status
        const validStatuses = ['unpaid', 'paid', 'partially_paid', 'cancelled'];
        if (payment_status && !validStatuses.includes(payment_status)) {
            return res.status(400).json({
                message: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}`
            });
        }
        // Validate payment method
        if (payment_method && !Object.values(constants_1.PAYMENT_METHODS).includes(payment_method)) {
            return res.status(400).json({
                message: `Invalid payment method. Must be one of: ${Object.values(constants_1.PAYMENT_METHODS).join(', ')}`
            });
        }
        const result = await client.query(`UPDATE oms.invoices 
       SET payment_status = COALESCE($1, payment_status), 
           payment_method = COALESCE($2, payment_method), 
           updated_at = CURRENT_TIMESTAMP
       WHERE invoice_id = $3 AND merchant_id = $4
       RETURNING *`, [payment_status, payment_method, id, merchantId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        const invoice = result.rows[0];
        logger_1.logger.info('Invoice status updated', {
            invoiceId: invoice.invoice_id,
            paymentStatus: invoice.payment_status,
            paymentMethod: invoice.payment_method
        });
        // Emit WebSocket event
        try {
            const io = global.io;
            if (io) {
                io.emit('invoice-status-updated', {
                    invoiceId: invoice.invoice_id,
                    paymentStatus: invoice.payment_status,
                    paymentMethod: invoice.payment_method,
                    timestamp: new Date().toISOString()
                });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event', { error: error instanceof Error ? error.message : String(error) });
        }
        res.json({
            message: 'Invoice status updated successfully',
            invoice: {
                invoice_id: invoice.invoice_id,
                payment_status: invoice.payment_status,
                payment_method: invoice.payment_method,
                updated_at: invoice.updated_at
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating invoice status', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update invoice status' });
    }
    finally {
        client.release();
    }
});
// Update invoice details
router.patch('/:id', async (req, res) => {
    console.log('🔍 PATCH /api/invoices/:id - Update invoice request received');
    console.log('📋 Request params:', req.params);
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const invoiceId = parseInt(id, 10);
        const { dueDate, notes, taxAmount, discountAmount, paymentStatus, paymentMethod } = req.body;
        console.log('📊 Extracted update fields:', {
            invoiceId,
            dueDate,
            notes,
            taxAmount,
            discountAmount,
            paymentStatus,
            paymentMethod
        });
        // Get user info from session
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            console.log('❌ User not found in database');
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        console.log('✅ Merchant ID found:', merchantId);
        // Validate payment status
        const validPaymentStatuses = ['unpaid', 'paid', 'partially_paid', 'cancelled'];
        if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
            console.log('❌ Invalid payment status:', paymentStatus);
            return res.status(400).json({
                message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`
            });
        }
        // Validate payment method
        if (paymentMethod && !Object.values(constants_1.PAYMENT_METHODS).includes(paymentMethod)) {
            console.log('❌ Invalid payment method:', paymentMethod);
            return res.status(400).json({
                message: `Invalid payment method. Must be one of: ${Object.values(constants_1.PAYMENT_METHODS).join(', ')}`
            });
        }
        await client.query('BEGIN');
        // Check if invoice exists and belongs to merchant
        const invoiceResult = await client.query('SELECT invoice_id, subtotal, tax_amount, discount_amount, total_amount FROM oms.invoices WHERE invoice_id = $1 AND merchant_id = $2', [invoiceId, merchantId]);
        if (invoiceResult.rows.length === 0) {
            console.log('❌ Invoice not found or access denied');
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Invoice not found' });
        }
        const currentInvoice = invoiceResult.rows[0];
        console.log('✅ Invoice found:', currentInvoice);
        // Calculate new total amount if discount changed (preserve existing GST)
        let newTotalAmount = currentInvoice.total_amount;
        if (discountAmount !== undefined) {
            const subtotal = parseFloat(currentInvoice.subtotal);
            const existingTax = parseFloat(currentInvoice.tax_amount);
            const newDiscountAmount = parseFloat(discountAmount) || 0;
            newTotalAmount = subtotal + existingTax - newDiscountAmount;
            console.log('💰 Recalculating total amount with GST preserved:', {
                subtotal,
                existingTax,
                newDiscountAmount,
                newTotalAmount
            });
        }
        // Update invoice
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;
        if (dueDate !== undefined) {
            updateFields.push(`due_date = $${paramCount}`);
            updateValues.push(dueDate);
            paramCount++;
        }
        if (notes !== undefined) {
            updateFields.push(`notes = $${paramCount}`);
            updateValues.push(notes);
            paramCount++;
        }
        if (taxAmount !== undefined) {
            updateFields.push(`tax_amount = $${paramCount}`);
            updateValues.push(taxAmount);
            paramCount++;
        }
        if (discountAmount !== undefined) {
            updateFields.push(`discount_amount = $${paramCount}`);
            updateValues.push(discountAmount);
            paramCount++;
        }
        if (paymentStatus !== undefined) {
            updateFields.push(`payment_status = $${paramCount}`);
            updateValues.push(paymentStatus);
            paramCount++;
        }
        if (paymentMethod !== undefined) {
            updateFields.push(`payment_method = $${paramCount}`);
            updateValues.push(paymentMethod);
            paramCount++;
        }
        // Always update total_amount and updated_at
        updateFields.push(`total_amount = $${paramCount}`);
        updateValues.push(newTotalAmount);
        paramCount++;
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        // Add invoice_id and merchant_id for WHERE clause
        updateValues.push(invoiceId, merchantId);
        const updateQuery = `
      UPDATE oms.invoices 
      SET ${updateFields.join(', ')}
      WHERE invoice_id = $${paramCount} AND merchant_id = $${paramCount + 1}
      RETURNING *
    `;
        console.log('🔄 Executing update query:', updateQuery);
        console.log('📊 Update values:', updateValues);
        const updateResult = await client.query(updateQuery, updateValues);
        if (updateResult.rows.length === 0) {
            console.log('❌ Update failed - no rows affected');
            await client.query('ROLLBACK');
            return res.status(500).json({ message: 'Failed to update invoice' });
        }
        const updatedInvoice = updateResult.rows[0];
        console.log('✅ Invoice updated successfully:', updatedInvoice);
        await client.query('COMMIT');
        // Emit WebSocket event
        try {
            const io = global.io;
            if (io) {
                io.emit('invoice-updated', {
                    invoiceId: invoiceId,
                    updatedFields: {
                        dueDate,
                        notes,
                        taxAmount,
                        discountAmount,
                        paymentStatus,
                        paymentMethod,
                        totalAmount: newTotalAmount
                    },
                    timestamp: new Date().toISOString()
                });
                console.log('📡 WebSocket event emitted for invoice update');
            }
        }
        catch (wsError) {
            console.log('⚠️ Could not emit WebSocket event for invoice update:', wsError);
        }
        res.json({
            message: 'Invoice updated successfully',
            invoice: {
                invoice_id: updatedInvoice.invoice_id,
                invoice_number: updatedInvoice.invoice_number,
                due_date: updatedInvoice.due_date,
                notes: updatedInvoice.notes,
                tax_amount: updatedInvoice.tax_amount,
                discount_amount: updatedInvoice.discount_amount,
                total_amount: updatedInvoice.total_amount,
                payment_status: updatedInvoice.payment_status,
                payment_method: updatedInvoice.payment_method,
                updated_at: updatedInvoice.updated_at
            }
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.log('❌ Error updating invoice:', error);
        logger_1.logger.error('Error updating invoice', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update invoice' });
    }
    finally {
        console.log('🔓 Releasing database connection...');
        client.release();
    }
});
// Download invoice as PDF
router.get('/:id/download', async (req, res) => {
    const { id } = req.params;
    const client = await db_1.pool.connect();
    try {
        // Get user info
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        // Get invoice with all details
        const invoiceQuery = `
      SELECT 
        i.*,
        mbd.invoice_prefix,
        mbd.invoice_logo_url,
        mbd.gst_number,
        mbd.pan_number,
        mbd.billing_address_line1,
        mbd.billing_address_line2,
        mbd.billing_city,
        mbd.billing_state,
        mbd.billing_pincode,
        mbd.billing_country,
        mbd.bank_name,
        mbd.bank_account_number,
        mbd.ifsc_code,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        c.address as customer_address,
        o.status as order_status
      FROM oms.invoices i
      LEFT JOIN oms.merchant_billing_details mbd ON i.merchant_id = mbd.merchant_id
      LEFT JOIN oms.orders o ON i.order_id = o.order_id
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      WHERE i.invoice_id = $1 AND i.merchant_id = $2
    `;
        const invoiceResult = await client.query(invoiceQuery, [id, merchantId]);
        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        const invoice = invoiceResult.rows[0];
        // Get invoice items with GST details
        const itemsQuery = `
      SELECT ii.*, p.product_name
      FROM oms.invoice_items ii
      LEFT JOIN oms.products p ON ii.product_id = p.product_id
      WHERE ii.invoice_id = $1
    `;
        const itemsResult = await client.query(itemsQuery, [id]);
        const items = itemsResult.rows;
        // Create PDF
        const doc = new pdfkit_1.default({ margin: 50, size: 'A4' });
        // Set response headers
        const invoiceNumber = `${invoice.invoice_prefix || 'INV-'}${String(invoice.invoice_number).padStart(5, '0')}`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
        // Pipe PDF to response
        doc.pipe(res);
        const pageWidth = doc.page.width;
        const margin = 50;
        let y = 60;
        // Header: TAX INVOICE (centered, bold)
        doc.fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 0, y, { align: 'center', width: pageWidth });
        y += 40;
        // Top right section: Date, Invoice No, Ref No
        const rightInfoX = pageWidth - 250;
        doc.fontSize(9).font('Helvetica');
        doc.text('Date:', rightInfoX, y);
        doc.text(new Date(invoice.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }), rightInfoX + 70, y);
        y += 15;
        doc.text('Invoice No.', rightInfoX, y);
        doc.text(invoiceNumber, rightInfoX + 70, y);
        y += 15;
        doc.text('Ref No.', rightInfoX, y);
        doc.text(`ORD${invoice.order_id}`, rightInfoX + 70, y);
        // Reset y for customer/merchant section
        y = 140;
        // Two column layout: To (left) and From (right)
        const leftColX = margin;
        const midPoint = pageWidth / 2;
        // Left: To (Customer)
        doc.fontSize(9).font('Helvetica-Bold').text('To,', leftColX, y);
        let leftY = y + 15;
        doc.font('Helvetica').fontSize(9);
        doc.text(invoice.customer_name || 'N/A', leftColX, leftY);
        leftY += 12;
        if (invoice.customer_phone) {
            doc.text(invoice.customer_phone, leftColX, leftY);
            leftY += 12;
        }
        if (invoice.customer_email) {
            doc.text(invoice.customer_email, leftColX, leftY);
            leftY += 12;
        }
        // Right: From (Seller)
        doc.fontSize(9).font('Helvetica-Bold').text('From (Seller):', midPoint, y);
        let rightY = y + 15;
        doc.font('Helvetica').fontSize(9);
        if (invoice.billing_address_line1) {
            const address = [
                invoice.billing_address_line1,
                invoice.billing_address_line2,
                invoice.billing_city,
                invoice.billing_state,
                invoice.billing_pincode
            ].filter(Boolean).join(', ');
            doc.text(address, midPoint, rightY, { width: pageWidth - midPoint - margin });
            rightY += 25;
        }
        if (invoice.gst_number) {
            doc.text('GST No.', midPoint, rightY);
            doc.text(invoice.gst_number, midPoint + 70, rightY);
            rightY += 12;
        }
        if (invoice.pan_number) {
            doc.text('PAN No.', midPoint, rightY);
            doc.text(invoice.pan_number, midPoint + 70, rightY);
            rightY += 12;
        }
        y = Math.max(leftY, rightY) + 25;
        // Items table with borders
        const tableTop = y;
        const tableWidth = pageWidth - 2 * margin;
        const slW = 30;
        const descW = 220;
        const hsnW = 70;
        const qtyW = 40;
        const rateW = 65;
        const amountW = 70;
        // Draw vertical lines for columns
        const drawVerticalLines = (yStart, height) => {
            doc.moveTo(margin, yStart).lineTo(margin, yStart + height).stroke();
            doc.moveTo(margin + slW, yStart).lineTo(margin + slW, yStart + height).stroke();
            doc.moveTo(margin + slW + descW, yStart).lineTo(margin + slW + descW, yStart + height).stroke();
            doc.moveTo(margin + slW + descW + hsnW, yStart).lineTo(margin + slW + descW + hsnW, yStart + height).stroke();
            doc.moveTo(margin + slW + descW + hsnW + qtyW, yStart).lineTo(margin + slW + descW + hsnW + qtyW, yStart + height).stroke();
            doc.moveTo(margin + slW + descW + hsnW + qtyW + rateW, yStart).lineTo(margin + slW + descW + hsnW + qtyW + rateW, yStart + height).stroke();
            doc.moveTo(margin + tableWidth, yStart).lineTo(margin + tableWidth, yStart + height).stroke();
        };
        // Table header with border
        doc.rect(margin, tableTop, tableWidth, 25).stroke();
        drawVerticalLines(tableTop, 25);
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('SL', margin + 2, tableTop + 8, { width: slW - 4, align: 'center' });
        doc.text('Particulars/ Description', margin + slW + 2, tableTop + 8, { width: descW - 4 });
        doc.text('HSN/SAC No', margin + slW + descW + 2, tableTop + 8, { width: hsnW - 4, align: 'center' });
        doc.text('Qty', margin + slW + descW + hsnW + 2, tableTop + 8, { width: qtyW - 4, align: 'center' });
        doc.text('Rate (Rs.)', margin + slW + descW + hsnW + qtyW + 2, tableTop + 8, { width: rateW - 4, align: 'right' });
        doc.text('Amount (Rs.)', margin + slW + descW + hsnW + qtyW + rateW + 2, tableTop + 8, { width: amountW - 4, align: 'right' });
        y = tableTop + 25;
        // Table rows with borders
        doc.font('Helvetica').fontSize(8);
        items.forEach((item, index) => {
            const rowHeight = 30;
            doc.rect(margin, y, tableWidth, rowHeight).stroke();
            drawVerticalLines(y, rowHeight);
            doc.text((index + 1).toString(), margin + 2, y + 10, { width: slW - 4, align: 'center' });
            doc.text(item.product_name || 'Product', margin + slW + 2, y + 10, { width: descW - 4 });
            doc.text(item.hsn_code || '-', margin + slW + descW + 2, y + 10, { width: hsnW - 4, align: 'center' });
            doc.text(item.quantity.toString(), margin + slW + descW + hsnW + 2, y + 10, { width: qtyW - 4, align: 'center' });
            doc.text(parseFloat(item.unit_price).toFixed(2), margin + slW + descW + hsnW + qtyW + 2, y + 10, { width: rateW - 4, align: 'right' });
            doc.text(parseFloat(item.total_amount).toFixed(2), margin + slW + descW + hsnW + qtyW + rateW + 2, y + 10, { width: amountW - 4, align: 'right' });
            y += rowHeight;
        });
        // GST breakdown section
        y += 15;
        doc.fontSize(9).font('Helvetica');
        const gstX = pageWidth - 200;
        if (invoice.cgst_amount > 0) {
            doc.text('CGST', margin + 20, y);
            doc.text(parseFloat(invoice.cgst_amount).toFixed(2), gstX, y);
            y += 15;
            doc.text('SGST', margin + 20, y);
            doc.text(parseFloat(invoice.sgst_amount || 0).toFixed(2), gstX, y);
            y += 15;
        }
        if (invoice.igst_amount > 0) {
            doc.text('IGST', margin + 20, y);
            doc.text(parseFloat(invoice.igst_amount).toFixed(2), gstX, y);
            y += 15;
        }
        // Grand Total
        y += 10;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Grand Total', margin + 20, y);
        doc.text(parseFloat(invoice.total_amount).toFixed(2), gstX, y);
        // Bank details section
        if (invoice.bank_name || invoice.bank_account_number || invoice.ifsc_code) {
            y += 40;
            doc.fontSize(10).font('Helvetica-Bold').text('BANK DETAILS:', margin, y);
            y += 18;
            doc.font('Helvetica').fontSize(9);
            if (invoice.bank_name) {
                doc.text('Bank Name:', margin, y);
                doc.text(invoice.bank_name, margin + 80, y);
                y += 15;
            }
            if (invoice.bank_account_number) {
                doc.text('A/C:', margin, y);
                doc.text(invoice.bank_account_number, margin + 80, y);
                y += 15;
            }
            if (invoice.ifsc_code) {
                doc.text('IFSC:', margin, y);
                doc.text(invoice.ifsc_code, margin + 80, y);
            }
        }
        // Finalize PDF
        doc.end();
        logger_1.logger.info('Invoice PDF generated', { invoiceId: id, invoiceNumber });
    }
    catch (error) {
        logger_1.logger.error('Error generating invoice PDF', error instanceof Error ? error.message : String(error));
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate invoice PDF' });
        }
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=invoices.js.map
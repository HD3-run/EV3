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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("./db");
const logger_1 = require("./utils/logger");
const constants_1 = require("./utils/constants");
// authenticateUser is imported for future use
const cache_1 = require("./middleware/cache");
const validation_1 = require("./middleware/validation");
const multer_1 = __importDefault(require("multer"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const router = (0, express_1.Router)();
// Helper function to auto-create invoice from paid order
async function createInvoiceFromPaidOrder(client, orderId, merchantId, totalAmount) {
    try {
        console.log('🔄 Creating invoice for paid order:', { orderId, merchantId, totalAmount });
        // Get order details with customer state
        const orderResult = await client.query(`SELECT o.order_id, o.total_amount, o.customer_id, o.status, c.state_code as customer_state_code
       FROM oms.orders o 
       LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
       WHERE o.order_id = $1 AND o.merchant_id = $2`, [orderId, merchantId]);
        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }
        const order = orderResult.rows[0];
        // Get merchant billing details with state code
        const billingResult = await client.query('SELECT billing_id, next_invoice_number, invoice_prefix, state_code FROM oms.merchant_billing_details WHERE merchant_id = $1', [merchantId]);
        if (billingResult.rows.length === 0) {
            throw new Error('Merchant billing details not found. Please set up billing details first.');
        }
        const { billing_id, next_invoice_number, invoice_prefix, state_code: merchantStateCode } = billingResult.rows[0];
        const customerStateCode = order.customer_state_code;
        console.log('📋 GST Calculation - Merchant State:', merchantStateCode, 'Customer State:', customerStateCode);
        // Update next_invoice_number atomically
        const invoiceNumberResult = await client.query('UPDATE oms.merchant_billing_details SET next_invoice_number = next_invoice_number + 1 WHERE merchant_id = $1 RETURNING next_invoice_number', [merchantId]);
        const invoiceNumber = invoiceNumberResult.rows[0].next_invoice_number;
        const invoicePrefix = invoice_prefix || 'INV-';
        // Calculate due date (30 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
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
            const gstAmount = (itemTotal * gstRate) / 100;
            subtotal += itemTotal;
            const isIntraState = merchantStateCode && customerStateCode && merchantStateCode === customerStateCode;
            let cgst = 0, sgst = 0, igst = 0;
            if (isIntraState) {
                cgst = gstAmount / 2;
                sgst = gstAmount / 2;
                totalCgst += cgst;
                totalSgst += sgst;
            }
            else {
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
        const finalTotalAmount = subtotal + totalGst;
        console.log('💰 GST Breakdown - CGST:', totalCgst.toFixed(2), 'SGST:', totalSgst.toFixed(2), 'IGST:', totalIgst.toFixed(2), 'Total:', finalTotalAmount.toFixed(2));
        // Create invoice header with GST breakdown
        const invoiceResult = await client.query(`INSERT INTO oms.invoices 
       (invoice_number, order_id, merchant_id, billing_id, invoice_date, due_date, 
        subtotal, tax_amount, discount_amount, total_amount, cgst_amount, sgst_amount, igst_amount, payment_status, notes)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8, $9, $10, $11, $12, 'paid', $13)
       RETURNING *`, [
            invoiceNumber,
            orderId,
            merchantId,
            billing_id,
            dueDate,
            subtotal,
            totalGst,
            0, // discount_amount
            finalTotalAmount,
            totalCgst,
            totalSgst,
            totalIgst,
            'Auto-generated invoice for paid order'
        ]);
        const invoice = invoiceResult.rows[0];
        // Insert invoice items with GST breakdown
        for (const item of itemsWithGst) {
            await client.query(`INSERT INTO oms.invoice_items 
         (invoice_id, order_item_id, product_id, inventory_id, quantity, unit_price, total_amount, 
          hsn_code, gst_rate, cgst_amount, sgst_amount, igst_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
                invoice.invoice_id,
                item.order_item_id,
                item.product_id,
                item.inventory_id,
                item.quantity,
                item.price_per_unit,
                item.total_price,
                item.hsn_code,
                item.gst_rate,
                item.cgst_amount,
                item.sgst_amount,
                item.igst_amount
            ]);
        }
        console.log('✅ Invoice created successfully:', {
            invoiceId: invoice.invoice_id,
            invoiceNumber: invoiceNumber,
            displayNumber: `${invoicePrefix}${invoiceNumber}`,
            orderId: orderId,
            totalAmount: finalTotalAmount
        });
        return {
            invoiceId: invoice.invoice_id,
            invoiceNumber: invoiceNumber,
            displayNumber: `${invoicePrefix}${invoiceNumber}`,
            totalAmount: finalTotalAmount
        };
    }
    catch (error) {
        console.log('❌ Error creating invoice for paid order:', error);
        throw error;
    }
}
// Get all orders with pagination and filtering
router.get('/', validation_1.validatePagination, (0, cache_1.cacheMiddleware)(30), async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { page = 1, limit = 10, status, channel, search, date } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const limitNum = Number(limit) || 10; // Allow unlimited orders to be loaded
        // Get user info from session
        const userResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            logger_1.logger.error('User not found in orders endpoint', {
                userId: req.session.userId,
                sessionId: req.sessionID
            });
            return res.status(401).json({ message: 'User not found' });
        }
        const { merchant_id: merchantId, role } = userResult.rows[0];
        if (process.env.NODE_ENV === 'development') {
            logger_1.logger.info('Orders endpoint called', {
                userId: req.session.userId,
                role: role,
                merchantId: merchantId,
                queryParams: { page, limit, status, channel, search }
            });
        }
        // OPTIMIZED: Single query with proper JOINs to eliminate N+1 problems
        let query = `
      SELECT 
        o.order_id, 
        o.customer_id, 
        o.order_source, 
        o.total_amount, 
        o.status,
        o.payment_status, 
        o.payment_method, 
        o.created_at, 
        o.updated_at,
        c.name as customer_name, 
        c.phone as customer_phone, 
        c.email as customer_email,
        COALESCE(p.amount, 0.00) as paid_amount,
        COALESCE(oi_summary.total_price, 0.00) as display_amount,
        COUNT(*) OVER() as total_count,
        COALESCE(oi_items.items_json, '[]'::json) as order_items
      FROM oms.orders o
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      LEFT JOIN oms.order_payments p ON o.order_id = p.order_id
      LEFT JOIN (
        SELECT order_id, SUM(total_price) as total_price
        FROM oms.order_items
        GROUP BY order_id
      ) oi_summary ON o.order_id = oi_summary.order_id
      LEFT JOIN (
        SELECT 
          oi.order_id,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'product_id', oi.product_id,
              'product_name', pr.product_name,
              'quantity', oi.quantity,
              'price_per_unit', oi.price_per_unit,
              'total_price', oi.total_price,
              'sku', oi.sku
            )
          ) as items_json
        FROM oms.order_items oi
        LEFT JOIN oms.products pr ON oi.product_id = pr.product_id
        GROUP BY oi.order_id
      ) oi_items ON o.order_id = oi_items.order_id
      WHERE o.merchant_id = $1
    `;
        const params = [merchantId];
        let paramIndex = 2;
        // If user is not admin, only show their assigned orders
        if (role !== 'admin') {
            query += ` AND o.user_id = $${paramIndex}`;
            params.push(req.session.userId);
            paramIndex++;
            if (process.env.NODE_ENV === 'development') {
                logger_1.logger.info('Non-admin user - filtering by user_id', {
                    userId: req.session.userId,
                    userIdType: typeof req.session.userId,
                    role: role
                });
            }
        }
        if (status && status !== 'all') {
            query += ` AND o.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        if (channel && channel !== 'all') {
            query += ` AND o.order_source = $${paramIndex}`;
            params.push(channel);
            paramIndex++;
        }
        if (search) {
            // Search by order_id, customer_id, or customer name
            query += ` AND (
        o.order_id::text ILIKE $${paramIndex} OR 
        o.customer_id::text ILIKE $${paramIndex} OR 
        c.name ILIKE $${paramIndex}
      )`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (date) {
            query += ` AND DATE(o.order_date) = $${paramIndex}`;
            params.push(date);
            paramIndex++;
        }
        query += ` ORDER BY o.order_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limitNum, offset);
        if (process.env.NODE_ENV === 'development') {
            logger_1.logger.info('Executing orders query', {
                query: query.replace(/\s+/g, ' '),
                params: params
            });
        }
        const result = await client.query(query, params);
        if (process.env.NODE_ENV === 'development') {
            logger_1.logger.info('Orders query result', {
                rowCount: result.rows.length,
                totalCount: result.rows[0]?.total_count || 0,
                sampleRow: result.rows[0] ? {
                    order_id: result.rows[0].order_id,
                    customer_name: result.rows[0].customer_name,
                    status: result.rows[0].status,
                    total_amount: result.rows[0].total_amount,
                    display_amount: result.rows[0].display_amount
                } : null
            });
        }
        // Enhanced response with debug info
        const response = {
            orders: result.rows,
            pagination: {
                page: Number(page),
                limit: limitNum,
                total: result.rows[0]?.total_count || 0,
                totalPages: Math.ceil((result.rows[0]?.total_count || 0) / limitNum)
            }
        };
        if (process.env.NODE_ENV === 'development') {
            response.debug = {
                queryParams: { page, limit, status, channel, search },
                userRole: role,
                merchantId,
                userId: req.session.userId,
                userIdType: typeof req.session.userId,
                queryExecuted: query.replace(/\s+/g, ' '),
                params: params,
                resultCount: result.rows.length,
                sampleOrder: result.rows[0] ? {
                    order_id: result.rows[0].order_id,
                    display_amount: result.rows[0].display_amount,
                    total_amount: result.rows[0].total_amount,
                    customer_name: result.rows[0].customer_name,
                    paid_amount: result.rows[0].paid_amount
                } : null
            };
        }
        // Add cache busting headers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(response);
    }
    catch (error) {
        logger_1.logger.error('Error fetching orders', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            userId: req.session.userId,
            query: req.query,
            path: req.path
        });
        res.status(500).json({
            message: 'Failed to fetch orders',
            debug: process.env.NODE_ENV === 'development' ? {
                error: error instanceof Error ? error.message : String(error)
            } : undefined
        });
    }
    finally {
        client.release();
    }
});
// Add manual order endpoint
router.post('/add-manual', validation_1.validateQuantity, async (req, res) => {
    logger_1.logger.info('Manual order creation request', { body: req.body, userId: req.session.userId });
    const client = await db_1.pool.connect();
    try {
        // Get merchant ID from current user session
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            logger_1.logger.error('User not found for manual order', { userId: req.session.userId });
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        await client.query('BEGIN');
        const { customerName, customerPhone, customerEmail, addressLine1, addressLine2, landmark, city, state, pincode, country, alternatePhone, isVerifiedAddress, deliveryNote, productName, productId, // NEW: Allow product selection by ID
        quantity, unitPrice, orderSource, state_code, gst_number } = req.body;
        // Calculate the correct total amount as quantity * unitPrice
        const calculatedTotalAmount = quantity * unitPrice;
        logger_1.logger.info('Manual order creation - input validation', {
            quantity: quantity,
            unitPrice: unitPrice,
            calculatedTotal: calculatedTotalAmount,
            note: 'total_amount will be set to quantity * unitPrice'
        });
        // Create or find customer
        let customerId;
        const customerResult = await client.query('SELECT customer_id FROM oms.customers WHERE phone = $1 AND merchant_id = $2', [customerPhone, merchantId]);
        if (customerResult.rows.length > 0) {
            customerId = customerResult.rows[0].customer_id;
            // Update existing customer with new address details if provided
            if (orderSource !== 'Manual' && addressLine1) {
                await client.query(`
          UPDATE oms.customers SET 
            name = $1, 
            email = $2, 
            address_line1 = $3, 
            address_line2 = $4, 
            landmark = $5, 
            city = $6, 
            state = $7, 
            pincode = $8, 
            country = $9, 
            alternate_phone = $10, 
            is_verified_address = $11, 
            delivery_note = $12,
            state_code = $13,
            gst_number = $14,
            updated_at = CURRENT_TIMESTAMP
          WHERE customer_id = $15 AND merchant_id = $16
        `, [
                    customerName,
                    customerEmail,
                    addressLine1,
                    addressLine2,
                    landmark,
                    city,
                    state,
                    pincode,
                    country || 'India',
                    alternatePhone,
                    isVerifiedAddress || false,
                    deliveryNote,
                    state_code || null,
                    gst_number || null,
                    customerId,
                    merchantId
                ]);
            }
        }
        else {
            // Create new customer with detailed address information
            const newCustomer = await client.query(`
        INSERT INTO oms.customers (
          merchant_id, name, phone, email, 
          address_line1, address_line2, landmark, city, state, pincode, country, 
          alternate_phone, is_verified_address, delivery_note, state_code, gst_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
        RETURNING customer_id
      `, [
                merchantId,
                customerName,
                customerPhone,
                customerEmail,
                addressLine1 || '',
                addressLine2 || '',
                landmark || '',
                city || '',
                state || '',
                pincode || '',
                country || 'India',
                alternatePhone || '',
                isVerifiedAddress || false,
                deliveryNote || '',
                state_code || null,
                gst_number || null
            ]);
            customerId = newCustomer.rows[0].customer_id;
        }
        // Create order
        const orderResult = await client.query('INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *', [merchantId, customerId, orderSource, calculatedTotalAmount, 'pending']);
        const order = orderResult.rows[0];
        logger_1.logger.info('Order created in database', {
            orderId: order.order_id,
            orderTotalAmount: order.total_amount,
            expectedTotalAmount: calculatedTotalAmount,
            match: order.total_amount === calculatedTotalAmount
        });
        // Check if product exists in inventory (by ID or name)
        let inventoryResult;
        if (productId) {
            // Search by product ID
            inventoryResult = await client.query('SELECT p.product_id, p.product_name, i.inventory_id, i.quantity_available, i.cost_price FROM oms.products p JOIN oms.inventory i ON p.product_id = i.product_id WHERE p.product_id = $1 AND p.merchant_id = $2', [productId, merchantId]);
        }
        else {
            // Search by product name (existing behavior)
            inventoryResult = await client.query('SELECT p.product_id, p.product_name, i.inventory_id, i.quantity_available, i.cost_price FROM oms.products p JOIN oms.inventory i ON p.product_id = i.product_id WHERE p.product_name = $1 AND p.merchant_id = $2', [productName, merchantId]);
        }
        if (inventoryResult.rows.length === 0) {
            await client.query('ROLLBACK');
            const identifier = productId ? `ID ${productId}` : `"${productName}"`;
            return res.status(400).json({ message: `Product ${identifier} not found in inventory. Please add it to inventory first.` });
        }
        const { product_id: foundProductId, product_name: foundProductName, inventory_id: inventoryId, quantity_available: availableStock } = inventoryResult.rows[0];
        if (availableStock < quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Insufficient stock for "${foundProductName}". Available: ${availableStock}, Required: ${quantity}` });
        }
        // Create order item with user-specified unitPrice (selling price), not inventory cost_price
        const calculatedTotalPrice = quantity * unitPrice;
        await client.query('INSERT INTO oms.order_items (order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7)', [order.order_id, foundProductId, inventoryId, `SKU-${foundProductId}`, quantity, unitPrice, calculatedTotalPrice]);
        logger_1.logger.info('Order item created in database', {
            orderId: order.order_id,
            productId: foundProductId,
            productName: foundProductName,
            quantity: quantity,
            unitPrice: unitPrice,
            calculatedTotalPrice: calculatedTotalPrice,
            insertedTotalPrice: calculatedTotalPrice,
            note: 'total_price now calculated as quantity * unitPrice'
        });
        // Update inventory - deduct ordered quantity
        await client.query('UPDATE oms.inventory SET quantity_available = quantity_available - $1 WHERE product_id = $2 AND merchant_id = $3', [quantity, foundProductId, merchantId]);
        // Log initial order status to history table
        await client.query('INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)', [order.order_id, null, 'pending', req.session.userId]);
        await client.query('COMMIT');
        // Invalidate cache after creating order
        (0, cache_1.invalidateUserCache)(req.session.userId);
        // Get the complete order data with customer info like the orders list API
        const completeOrderResult = await client.query(`
      SELECT o.order_id, o.customer_id, o.order_source, o.total_amount, o.status,
             o.payment_status, o.payment_method, o.created_at, o.updated_at,
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             COALESCE((
               SELECT SUM(oi.total_price)
               FROM oms.order_items oi
               WHERE oi.order_id = o.order_id
             ), 0.00) as display_amount,
             COALESCE((
               SELECT JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'product_id', oi.product_id,
                   'product_name', pr.product_name,
                   'quantity', oi.quantity,
                   'price_per_unit', oi.price_per_unit,
                   'total_price', oi.total_price,
                   'sku', oi.sku
                 )
               )
               FROM oms.order_items oi
               LEFT JOIN oms.products pr ON oi.product_id = pr.product_id
               WHERE oi.order_id = o.order_id
             ), '[]'::json) as order_items
      FROM oms.orders o
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = $1 AND o.merchant_id = $2
    `, [order.order_id, merchantId]);
        const completeOrder = completeOrderResult.rows[0];
        // Send WebSocket notification for live updates
        if (global.io) {
            global.io.emit('orderCreated', {
                type: 'orderCreated',
                order: completeOrder,
                timestamp: new Date().toISOString()
            });
        }
        logger_1.logger.info('Manual order created successfully', {
            orderId: order.order_id,
            customerName: completeOrder.customer_name,
            displayAmount: completeOrder.display_amount,
            orderItemsCount: completeOrder.order_items ? completeOrder.order_items.length : 0,
            orderItems: completeOrder.order_items
        });
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.status(201).json(completeOrder);
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error creating manual order', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to create order' });
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    finally {
        client.release();
    }
});
// Create new order
router.post('/', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        // Get merchant ID from current user session
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        await client.query('BEGIN');
        const { channel, items, totalAmount } = req.body;
        // Calculate the correct total amount as sum of all items (quantity * unitPrice)
        const orderTotalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        logger_1.logger.info('Bulk order creation - total calculation', {
            itemsCount: items.length,
            items: items.map((item) => ({
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                itemTotal: item.quantity * item.unitPrice
            })),
            calculatedTotalAmount: orderTotalAmount,
            providedTotalAmount: totalAmount
        });
        // Insert order
        const orderResult = await client.query(`
      INSERT INTO oms.orders (merchant_id, order_source, total_amount, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `, [merchantId, channel, orderTotalAmount]);
        const order = orderResult.rows[0];
        // Insert order items
        for (const item of items) {
            // Get inventory_id for this product
            const inventoryResult = await client.query('SELECT inventory_id FROM oms.inventory WHERE product_id = $1 AND merchant_id = $2', [item.productId, merchantId]);
            const inventoryId = inventoryResult.rows.length > 0 ? inventoryResult.rows[0].inventory_id : null;
            const calculatedTotalPrice = item.quantity * item.unitPrice;
            await client.query(`
        INSERT INTO oms.order_items (order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [order.order_id, item.productId, inventoryId, item.sku || 'SKU', item.quantity, item.unitPrice, calculatedTotalPrice]);
            // Update inventory
            await client.query(`
        UPDATE oms.inventory 
        SET quantity_available = quantity_available - $1
        WHERE product_id = $2 AND merchant_id = $3
      `, [item.quantity, item.productId, merchantId]);
        }
        // Log initial order status to history table
        await client.query('INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)', [order.order_id, null, 'pending', req.session.userId]);
        await client.query('COMMIT');
        // Invalidate cache after creating order
        (0, cache_1.invalidateUserCache)(req.session.userId);
        // Get the complete order data with customer info like the orders list API
        const completeOrderResult = await client.query(`
      SELECT o.order_id, o.customer_id, o.order_source, o.total_amount, o.status,
             o.payment_status, o.payment_method, o.created_at, o.updated_at,
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             COALESCE((
               SELECT SUM(oi.total_price)
               FROM oms.order_items oi
               WHERE oi.order_id = o.order_id
             ), 0.00) as display_amount,
             COALESCE((
               SELECT JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'product_id', oi.product_id,
                   'product_name', pr.product_name,
                   'quantity', oi.quantity,
                   'price_per_unit', oi.price_per_unit,
                   'total_price', oi.total_price,
                   'sku', oi.sku
                 )
               )
               FROM oms.order_items oi
               LEFT JOIN oms.products pr ON oi.product_id = pr.product_id
               WHERE oi.order_id = o.order_id
             ), '[]'::json) as order_items
      FROM oms.orders o
      LEFT JOIN oms.customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = $1 AND o.merchant_id = $2
    `, [order.order_id, merchantId]);
        const completeOrder = completeOrderResult.rows[0];
        // Send WebSocket notification for live updates
        if (global.io) {
            global.io.emit('orderCreated', {
                type: 'orderCreated',
                order: completeOrder,
                timestamp: new Date().toISOString()
            });
        }
        logger_1.logger.info('Order created successfully', {
            orderId: order.order_id,
            customerName: completeOrder.customer_name,
            displayAmount: completeOrder.display_amount
        });
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.status(201).json(completeOrder);
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error creating order', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to create order' });
    }
    finally {
        client.release();
    }
});
// CSV upload endpoint
router.post('/upload-csv', upload.single('file'), async (req, res) => {
    logger_1.logger.info('POST /api/orders/upload-csv - Request received', {
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
        // Get merchant ID from current user session
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        logger_1.logger.info('User lookup for CSV upload', { userFound: userResult.rows.length > 0, userId: req.session.userId });
        if (userResult.rows.length === 0) {
            logger_1.logger.error('User not found for CSV upload', { userId: req.session.userId });
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        logger_1.logger.info('Processing CSV for merchant', { merchantId });
        const orders = [];
        const errors = [];
        const createdOrders = [];
        // Parse CSV
        const stream = stream_1.Readable.from(req.file.buffer.toString());
        await new Promise((resolve, reject) => {
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                try {
                    // Expected CSV columns: customer_name, customer_phone, customer_email, customer_address, product_name, quantity, unit_price, order_source
                    const order = {
                        customerName: row.customer_name || row['Customer Name'],
                        customerPhone: row.customer_phone || row['Customer Phone'],
                        customerEmail: row.customer_email || row['Customer Email'],
                        customerAddress: row.customer_address || row['Customer Address'],
                        customerState: row.customer_state || row['Customer State'] || '',
                        customerStateCode: row.customer_state_code || row['Customer State Code'] || null,
                        customerGstNumber: row.customer_gst_number || row['Customer GST Number'] || null,
                        productName: row.product_name || row['Product Name'],
                        quantity: parseInt(row.quantity || row['Quantity'], 10),
                        unitPrice: parseFloat(row.unit_price || row['Unit Price']),
                        orderSource: row.order_source || row['Order Source'] || 'CSV'
                    };
                    // Calculate the correct total amount as quantity * unitPrice
                    order.totalAmount = order.quantity * order.unitPrice;
                    orders.push(order);
                }
                catch (error) {
                    errors.push(`Error parsing row: ${JSON.stringify(row)} - ${error}`);
                }
            })
                .on('end', resolve)
                .on('error', reject);
        });
        if (orders.length === 0) {
            return res.status(400).json({ message: 'No valid orders found in CSV', errors });
        }
        // Emit initial progress event
        if (global.io) {
            const connectedClients = global.io.sockets.sockets.size;
            console.log('Emitting initial progress event for orders upload:', uploadId, 'to', connectedClients, 'connected clients');
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
                totalItems: orders.length,
                processedItems: 0,
                currentItem: 'Starting order processing...',
                status: 'processing'
            };
            console.log('Initial progress data:', initialProgressData);
            global.io.emit('csv-upload-progress', initialProgressData);
        }
        else {
            console.log('❌ Global io not available for progress tracking');
        }
        await client.query('BEGIN');
        // BATCH PROCESSING: Process orders in batches of 500 for efficiency
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(orders.length / BATCH_SIZE);
        logger_1.logger.info('Starting BATCH PROCESSING for orders', {
            totalOrders: orders.length,
            batchSize: BATCH_SIZE,
            totalBatches,
            merchantId
        });
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * BATCH_SIZE;
            const endIndex = Math.min(startIndex + BATCH_SIZE, orders.length);
            const batch = orders.slice(startIndex, endIndex);
            try {
                logger_1.logger.info('Processing orders batch', {
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
                        progress: Math.round((startIndex / orders.length) * 100),
                        currentItem: `Processing orders batch ${batchIndex + 1}/${totalBatches} (${batch.length} orders)`,
                        totalItems: orders.length,
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
                // Process entire batch in a single transaction with TRUE BATCH OPERATIONS
                await client.query('BEGIN');
                const batchResults = [];
                // Step 1: Batch validate all products exist in inventory
                const productNames = batch.map(order => order.productName);
                const productValidationQuery = `
          SELECT p.product_name, p.product_id, i.inventory_id, i.quantity_available, i.cost_price, p.sku
          FROM oms.products p 
          JOIN oms.inventory i ON p.product_id = i.product_id 
          WHERE p.product_name = ANY($1) AND p.merchant_id = $2
        `;
                const productValidationResult = await client.query(productValidationQuery, [productNames, merchantId]);
                const availableProducts = new Map();
                productValidationResult.rows.forEach(row => {
                    availableProducts.set(row.product_name, {
                        productId: row.product_id,
                        inventoryId: row.inventory_id,
                        availableStock: row.quantity_available,
                        costPrice: row.cost_price,
                        sku: row.sku
                    });
                });
                // Step 2: Filter out orders with invalid products
                const validOrders = [];
                for (const orderData of batch) {
                    const productInfo = availableProducts.get(orderData.productName);
                    if (!productInfo) {
                        errors.push(`Product "${orderData.productName}" not found in inventory. Please add it to inventory first.`);
                        continue;
                    }
                    if (productInfo.availableStock <= 0 || productInfo.availableStock < orderData.quantity) {
                        errors.push(`Insufficient stock for "${orderData.productName}". Available: ${productInfo.availableStock}, Required: ${orderData.quantity}`);
                        continue;
                    }
                    validOrders.push({ ...orderData, productInfo });
                }
                if (validOrders.length === 0) {
                    await client.query('ROLLBACK');
                    continue;
                }
                // Step 3: Batch create/find customers
                const customerPhones = validOrders.map(order => order.customerPhone);
                const existingCustomersQuery = `
          SELECT customer_id, phone FROM oms.customers 
          WHERE phone = ANY($1) AND merchant_id = $2
        `;
                const existingCustomersResult = await client.query(existingCustomersQuery, [customerPhones, merchantId]);
                const existingCustomers = new Map();
                existingCustomersResult.rows.forEach(row => {
                    existingCustomers.set(row.phone, row.customer_id);
                });
                // Step 4: Batch insert new customers (handle duplicates gracefully)
                const newCustomers = validOrders.filter(order => !existingCustomers.has(order.customerPhone));
                if (newCustomers.length > 0) {
                    // Remove duplicates within the batch itself
                    const uniqueCustomers = new Map();
                    newCustomers.forEach(order => {
                        if (!uniqueCustomers.has(order.customerPhone)) {
                            uniqueCustomers.set(order.customerPhone, order);
                        }
                    });
                    const uniqueCustomerArray = Array.from(uniqueCustomers.values());
                    const customerValues = uniqueCustomerArray.map((_, index) => `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8})`).join(', ');
                    const customerParams = uniqueCustomerArray.flatMap(order => [
                        merchantId,
                        // Truncate customer name to 255 characters (database limit)
                        (order.customerName || '').substring(0, 255),
                        // Truncate phone to 20 characters (database limit)
                        (order.customerPhone || '').substring(0, 20),
                        // Truncate email to 255 characters (database limit)
                        (order.customerEmail || '').substring(0, 255),
                        // Address can be TEXT, so no truncation needed
                        order.customerAddress || '',
                        order.customerState || '',
                        order.customerStateCode || null,
                        order.customerGstNumber || null
                    ]);
                    const newCustomersQuery = `
            INSERT INTO oms.customers (merchant_id, name, phone, email, address, state, state_code, gst_number) 
            VALUES ${customerValues} 
            ON CONFLICT (merchant_id, phone) DO UPDATE SET
              name = EXCLUDED.name,
              email = EXCLUDED.email,
              address = EXCLUDED.address,
              state = EXCLUDED.state,
              state_code = EXCLUDED.state_code,
              gst_number = EXCLUDED.gst_number
            RETURNING customer_id, phone
          `;
                    const newCustomersResult = await client.query(newCustomersQuery, customerParams);
                    newCustomersResult.rows.forEach(row => {
                        existingCustomers.set(row.phone, row.customer_id);
                    });
                }
                // OPTIMIZED: Batch create orders with better error handling
                const orderValues = validOrders.map((_, index) => `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`).join(', ');
                const orderParams = validOrders.flatMap(order => [
                    merchantId,
                    existingCustomers.get(order.customerPhone),
                    // Truncate order source to 50 characters (database limit)
                    (order.orderSource || 'csv_upload').substring(0, 50),
                    order.totalAmount || 0,
                    'pending'
                ]);
                const ordersQuery = `
          INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) 
          VALUES ${orderValues} 
          RETURNING order_id, customer_id, total_amount, status
        `;
                const ordersResult = await client.query(ordersQuery, orderParams);
                // Step 6: Batch create order items
                const orderItemValues = validOrders.map((_, index) => `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`).join(', ');
                const orderItemParams = validOrders.flatMap((order, index) => [
                    ordersResult.rows[index].order_id,
                    order.productInfo.productId,
                    order.productInfo.inventoryId,
                    // Truncate SKU to 100 characters (database limit)
                    (order.productInfo.sku || '').substring(0, 100),
                    order.quantity,
                    order.unitPrice,
                    order.quantity * order.unitPrice
                ]);
                const orderItemsQuery = `
          INSERT INTO oms.order_items (order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price) 
          VALUES ${orderItemValues}
        `;
                await client.query(orderItemsQuery, orderItemParams);
                // Step 7: Batch update inventory
                const inventoryUpdates = new Map();
                validOrders.forEach(order => {
                    const key = order.productInfo.productId;
                    if (inventoryUpdates.has(key)) {
                        inventoryUpdates.set(key, inventoryUpdates.get(key) + order.quantity);
                    }
                    else {
                        inventoryUpdates.set(key, order.quantity);
                    }
                });
                for (const [productId, totalQuantity] of inventoryUpdates) {
                    // Safety check: prevent negative stock
                    await client.query('UPDATE oms.inventory SET quantity_available = GREATEST(0, quantity_available - $1) WHERE product_id = $2 AND merchant_id = $3', [totalQuantity, productId, merchantId]);
                }
                // Step 8: Batch create order status history
                const historyValues = ordersResult.rows.map((_, index) => `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`).join(', ');
                const historyParams = ordersResult.rows.flatMap(order => [
                    order.order_id,
                    null,
                    'pending',
                    req.session.userId
                ]);
                const historyQuery = `
          INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) 
          VALUES ${historyValues}
        `;
                await client.query(historyQuery, historyParams);
                // Add successful results
                batchResults.push(...ordersResult.rows);
                // Commit batch transaction
                await client.query('COMMIT');
                // Add successful results
                createdOrders.push(...batchResults);
                logger_1.logger.info('Orders batch processed successfully', {
                    batchIndex: batchIndex + 1,
                    batchSize: batch.length,
                    validOrders: validOrders.length,
                    totalProcessed: createdOrders.length,
                    errors: errors.length,
                    sampleCustomer: validOrders.length > 0 ? {
                        name: validOrders[0].customerName?.substring(0, 50),
                        phone: validOrders[0].customerPhone?.substring(0, 20),
                        email: validOrders[0].customerEmail?.substring(0, 50)
                    } : null
                });
                // Emit batch completion progress
                if (global.io) {
                    const progressData = {
                        uploadId: uploadId,
                        progress: Math.round((endIndex / orders.length) * 100),
                        currentItem: `Completed orders batch ${batchIndex + 1}/${totalBatches}`,
                        totalItems: orders.length,
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
                console.error('Error processing orders batch:', error);
                logger_1.logger.error('Error processing orders batch', {
                    batchIndex: batchIndex + 1,
                    batchSize: batch.length,
                    error: error instanceof Error ? error.message : String(error),
                    errorCode: error.code,
                    errorDetail: error.detail
                });
                // Add individual items from failed batch to errors
                batch.forEach((orderData) => {
                    errors.push(`Error creating order for ${orderData.customerName}: ${String(error)}`);
                });
            }
        }
        await client.query('COMMIT');
        // Emit final progress event
        if (global.io) {
            const finalProgressData = {
                uploadId: uploadId,
                progress: 100,
                totalItems: orders.length,
                processedItems: createdOrders.length, // Show actual successful count, not total
                currentItem: `Completed! Created ${createdOrders.length} orders`,
                status: 'completed',
                created: createdOrders.length,
                errors: errors.length,
                errorDetails: errors, // Include detailed error information
                successMessage: `Successfully processed ${createdOrders.length} orders${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
            };
            console.log('Emitting final progress event:', finalProgressData);
            global.io.emit('csv-upload-progress', finalProgressData);
        }
        logger_1.logger.info('CSV orders processed', {
            totalRows: orders.length,
            created: createdOrders.length,
            errors: errors.length
        });
        // Invalidate user cache after CSV upload to ensure fresh data
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({
            message: `Successfully processed ${createdOrders.length} orders using BATCH PROCESSING`,
            created: createdOrders.length,
            errors: errors.length,
            errorDetails: errors,
            uploadId: uploadId,
            batchProcessing: true,
            totalBatches,
            batchSize: BATCH_SIZE,
            processingMethod: 'Batch Processing (500 orders per batch)'
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error processing CSV upload', error instanceof Error ? error.message : String(error));
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
// Create sample data for testing
router.post('/create-sample', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        await client.query('BEGIN');
        // Create sample customer
        const customerResult = await client.query('INSERT INTO oms.customers (merchant_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id', [merchantId, 'Sample Customer', '+1234567890', 'customer@example.com', '123 Sample Street']);
        const customerId = customerResult.rows[0].customer_id;
        // Create sample product (database will auto-generate SKU)
        const productResult = await client.query('INSERT INTO oms.products (merchant_id, product_name, category) VALUES ($1, $2, $3) RETURNING product_id, sku', [merchantId, 'Sample Product', 'Electronics']);
        const productId = productResult.rows[0].product_id;
        const sampleSku = productResult.rows[0].sku; // Fetch auto-generated SKU from database
        // Create sample inventory
        const inventoryResult = await client.query('INSERT INTO oms.inventory (merchant_id, product_id, quantity_available, reorder_level) VALUES ($1, $2, $3, $4) RETURNING inventory_id', [merchantId, productId, 100, 10]);
        const inventoryId = inventoryResult.rows[0].inventory_id;
        // Create sample order
        const orderResult = await client.query('INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *', [merchantId, customerId, 'Manual', 99.99, 'pending']);
        const orderId = orderResult.rows[0].order_id;
        // Create order item
        const sampleTotalPrice = 1 * 99.99; // quantity * unitPrice
        await client.query('INSERT INTO oms.order_items (order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7)', [orderId, productId, inventoryId, sampleSku, 1, 99.99, sampleTotalPrice]);
        await client.query('COMMIT');
        res.json({ message: 'Sample data created successfully', orderId, productId, customerId });
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error creating sample data', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to create sample data' });
    }
    finally {
        client.release();
    }
});
// Debug endpoint - only available in development
if (process.env.NODE_ENV === 'development') {
    router.get('/debug', async (req, res) => {
        const client = await db_1.pool.connect();
        try {
            const userResult = await client.query('SELECT merchant_id, role, username FROM oms.users WHERE user_id = $1', [req.session.userId]);
            if (userResult.rows.length === 0) {
                return res.status(401).json({ message: constants_1.MESSAGES.USER_NOT_FOUND });
            }
            const { merchant_id: merchantId, role, username } = userResult.rows[0];
            // Enhanced debug information
            const [ordersCount, assignedCount, usersCount, productsCount, specificAssignedOrders] = await Promise.all([
                client.query('SELECT COUNT(*) as total FROM oms.orders WHERE merchant_id = $1', [merchantId]),
                client.query('SELECT COUNT(*) as assigned FROM oms.orders WHERE merchant_id = $1 AND user_id = $2', [merchantId, req.session.userId]),
                client.query('SELECT user_id, username, role FROM oms.users WHERE merchant_id = $1', [merchantId]),
                client.query('SELECT COUNT(*) as total FROM oms.products WHERE merchant_id = $1', [merchantId]),
                client.query('SELECT o.order_id, o.order_source, o.total_amount, o.status, o.created_at, c.name as customer_name FROM oms.orders o LEFT JOIN oms.customers c ON o.customer_id = c.customer_id WHERE o.merchant_id = $1 AND o.user_id = $2', [merchantId, req.session.userId])
            ]);
            res.json({
                user: { role, merchantId, userId: req.session.userId, username },
                data: {
                    totalOrders: ordersCount.rows[0].total,
                    assignedOrders: assignedCount.rows[0].assigned,
                    totalProducts: productsCount.rows[0].total
                },
                assignedOrderDetails: specificAssignedOrders.rows,
                allUsers: usersCount.rows,
                sessionInfo: {
                    sessionId: req.sessionID,
                    hasSession: !!req.session,
                    sessionUserId: req.session?.userId,
                    sessionUserIdType: typeof req.session?.userId
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Debug endpoint error', error instanceof Error ? error.message : String(error));
            res.status(500).json({ message: 'Debug failed', error: error instanceof Error ? error.message : String(error) });
        }
        finally {
            client.release();
        }
    });
}
// Update order item prices
router.patch('/:id/price', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { pricePerUnit } = req.body;
        if (pricePerUnit === undefined || pricePerUnit < 0) {
            return res.status(400).json({ message: 'Valid price_per_unit is required and must be non-negative' });
        }
        // Get user info from session
        const userResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const { merchant_id: merchantId, role } = userResult.rows[0];
        // Only admins can update prices
        if (role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can update order prices' });
        }
        await client.query('BEGIN');
        // Check if order exists and belongs to merchant
        const orderResult = await client.query('SELECT order_id, total_amount FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [id, merchantId]);
        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found' });
        }
        const originalOrderAmount = parseFloat(orderResult.rows[0].total_amount);
        logger_1.logger.info('Updating order item prices', {
            orderId: id,
            newPricePerUnit: pricePerUnit,
            originalOrderAmount: originalOrderAmount
        });
        // Update all order items with new price_per_unit and recalculate totals
        await client.query('UPDATE oms.order_items SET price_per_unit = $1, total_price = (quantity::numeric * $1::numeric) WHERE order_id = $2', [pricePerUnit, id]);
        // Recalculate order total_amount based on updated order items
        const totalResult = await client.query('SELECT COALESCE(SUM(total_price), 0) as new_total FROM oms.order_items WHERE order_id = $1', [id]);
        const newTotalAmount = parseFloat(totalResult.rows[0].new_total);
        // Update the order total_amount
        await client.query('UPDATE oms.orders SET total_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3', [newTotalAmount, id, merchantId]);
        await client.query('COMMIT');
        logger_1.logger.info('Order prices updated successfully', {
            orderId: id,
            newPricePerUnit: pricePerUnit,
            originalOrderAmount: originalOrderAmount,
            newTotalAmount: newTotalAmount,
            note: 'total_price and total_amount recalculated based on new unit price'
        });
        // Invalidate cache after price update
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({
            message: 'Order prices updated successfully',
            orderId: id,
            newPricePerUnit: pricePerUnit,
            originalTotalAmount: originalOrderAmount,
            newTotalAmount: newTotalAmount,
            note: 'total_price and total_amount recalculated based on new unit price'
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error updating order prices', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update order prices' });
    }
    finally {
        client.release();
    }
});
// Update payment status
router.patch('/:id/payment', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const orderId = parseInt(id, 10); // Ensure it's a number
        console.log('🔍 Payment update request for order ID:', orderId, 'type:', typeof orderId);
        // Variables to track invoice creation status
        let invoiceCreationFailed = false;
        let invoiceCreationError = '';
        const { status, paymentMethod, amount, pricePerUnit } = req.body;
        // Get user info from session
        const userResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const { merchant_id: merchantId } = userResult.rows[0];
        // Validate payment status
        const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
        if (!validPaymentStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}` });
        }
        // Validate payment method if provided
        if (paymentMethod && !Object.values(constants_1.PAYMENT_METHODS).includes(paymentMethod)) {
            return res.status(400).json({ message: `Invalid payment method. Must be one of: ${Object.values(constants_1.PAYMENT_METHODS).join(', ')}` });
        }
        await client.query('BEGIN');
        // Check if order exists and belongs to merchant
        const orderResult = await client.query('SELECT order_id, total_amount, payment_status, status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [orderId, merchantId]);
        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found' });
        }
        // Prevent changing payment status back to pending when it's already paid
        const currentPaymentStatus = orderResult.rows[0].payment_status;
        if (currentPaymentStatus === 'paid' && status === 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot change payment status back to pending once order is paid' });
        }
        const orderAmount = parseFloat(orderResult.rows[0].total_amount);
        const paymentAmount = amount || orderAmount;
        let newTotalAmount = orderAmount; // Default to original amount
        logger_1.logger.info('Payment update - price_per_unit validation', {
            orderId: orderId,
            originalOrderAmount: orderAmount,
            requestedPaymentAmount: amount,
            finalPaymentAmount: paymentAmount,
            pricePerUnitRequested: pricePerUnit,
            amountsMatch: orderAmount === paymentAmount,
            note: 'price_per_unit changes will be applied to order items when marking as paid'
        });
        // Update price_per_unit for order items if provided and status is paid
        if (pricePerUnit !== undefined && status === 'paid') {
            logger_1.logger.info('Updating price_per_unit for order items during payment', {
                orderId: orderId,
                newPricePerUnit: pricePerUnit
            });
            // Update all order items with new price_per_unit and recalculate total_price
            await client.query('UPDATE oms.order_items SET price_per_unit = $1, total_price = (quantity::numeric * $1::numeric) WHERE order_id = $2', [pricePerUnit, orderId]);
            // Recalculate order total_amount based on updated order items
            const totalResult = await client.query('SELECT COALESCE(SUM(total_price), 0) as new_total FROM oms.order_items WHERE order_id = $1', [orderId]);
            newTotalAmount = parseFloat(totalResult.rows[0].new_total);
            // Update the order total_amount
            await client.query('UPDATE oms.orders SET total_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3', [newTotalAmount, orderId, merchantId]);
            logger_1.logger.info('Order items price_per_unit and totals updated during payment', {
                orderId: orderId,
                newPricePerUnit: pricePerUnit,
                newTotalAmount: newTotalAmount,
                note: 'total_price and total_amount recalculated based on new unit price'
            });
        }
        // Check if payment record exists
        const existingPayment = await client.query('SELECT payment_id FROM oms.order_payments WHERE order_id = $1', [orderId]);
        if (existingPayment.rows.length > 0) {
            // Update existing payment
            await client.query('UPDATE oms.order_payments SET status = $1, payment_method = $2, amount = $3, payment_date = CURRENT_TIMESTAMP WHERE order_id = $4', [status, paymentMethod || 'cash', paymentAmount, orderId]);
        }
        else {
            // Create new payment record
            await client.query('INSERT INTO oms.order_payments (order_id, status, payment_method, amount, payment_date) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)', [orderId, status, paymentMethod || 'cash', paymentAmount]);
        }
        // Update orders table payment_status, payment_method, and total_amount when paid
        if (status === 'paid') {
            // Get current order status to preserve 'cancelled' status
            const currentOrderStatus = orderResult.rows[0].status;
            const newOrderStatus = currentOrderStatus === 'cancelled' ? 'cancelled' : 'confirmed';
            logger_1.logger.info('Payment update - status preservation logic', {
                orderId: orderId,
                currentOrderStatus: currentOrderStatus,
                newOrderStatus: newOrderStatus,
                paymentStatus: status,
                preservedCancelledStatus: currentOrderStatus === 'cancelled'
            });
            // Update payment status, method, and conditionally change order status to 'confirmed' (except for cancelled orders)
            await client.query('UPDATE oms.orders SET payment_status = $1, payment_method = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE order_id = $4 AND merchant_id = $5', [status, paymentMethod || 'cash', newOrderStatus, orderId, merchantId]);
            // Log status change to order_status_history if status changed
            if (currentOrderStatus !== newOrderStatus) {
                await client.query('INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)', [orderId, currentOrderStatus, newOrderStatus, merchantId]);
                logger_1.logger.info('Order status change logged to history', {
                    orderId: orderId,
                    oldStatus: currentOrderStatus,
                    newStatus: newOrderStatus,
                    changedBy: merchantId
                });
            }
            logger_1.logger.info('Payment marked as paid - totals updated based on new unit price', {
                orderId: orderId,
                originalOrderAmount: orderAmount,
                paymentAmount: paymentAmount,
                newTotalAmount: newTotalAmount,
                totalAmountUpdated: true,
                pricePerUnitChanged: pricePerUnit !== undefined,
                newPricePerUnit: pricePerUnit
            });
            // Auto-create invoice when order is marked as paid
            try {
                console.log('🔄 Auto-creating invoice for paid order:', orderId);
                // Check if invoice already exists for this order
                const existingInvoice = await client.query('SELECT invoice_id FROM oms.invoices WHERE order_id = $1', [orderId]);
                if (existingInvoice.rows.length === 0) {
                    // Create invoice automatically
                    const invoiceResult = await createInvoiceFromPaidOrder(client, orderId, merchantId, newTotalAmount);
                    if (invoiceResult) {
                        console.log('✅ Auto-created invoice:', invoiceResult.invoiceId, 'for order:', orderId);
                        logger_1.logger.info('Auto-created invoice for paid order', {
                            orderId: orderId,
                            invoiceId: invoiceResult.invoiceId,
                            invoiceNumber: invoiceResult.invoiceNumber,
                            displayNumber: invoiceResult.displayNumber
                        });
                        // Emit WebSocket event for auto-created invoice
                        try {
                            const io = global.io;
                            if (io) {
                                io.emit('invoice-auto-created', {
                                    orderId: orderId,
                                    invoiceId: invoiceResult.invoiceId,
                                    invoiceNumber: invoiceResult.invoiceNumber,
                                    displayNumber: invoiceResult.displayNumber,
                                    totalAmount: invoiceResult.totalAmount,
                                    timestamp: new Date().toISOString()
                                });
                                console.log('📡 WebSocket event emitted for auto-created invoice:', invoiceResult.displayNumber);
                            }
                        }
                        catch (wsError) {
                            console.log('⚠️ Could not emit WebSocket event for auto-created invoice:', wsError);
                        }
                    }
                }
                else {
                    console.log('📋 Invoice already exists for order:', orderId, 'invoice_id:', existingInvoice.rows[0].invoice_id);
                }
            }
            catch (invoiceError) {
                // Don't fail the payment update if invoice creation fails, but return a warning
                console.log('⚠️ Failed to auto-create invoice for order:', orderId, 'Error:', invoiceError);
                logger_1.logger.warn('Failed to auto-create invoice for paid order', {
                    orderId: orderId,
                    error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError)
                });
                // Set a flag to indicate invoice creation failed
                invoiceCreationFailed = true;
                invoiceCreationError = invoiceError instanceof Error ? invoiceError.message : String(invoiceError);
            }
        }
        else {
            // For non-paid statuses, only update payment_status and payment_method
            await client.query('UPDATE oms.orders SET payment_status = $1, payment_method = $2, updated_at = CURRENT_TIMESTAMP WHERE order_id = $3 AND merchant_id = $4', [status, paymentMethod || 'cash', orderId, merchantId]);
        }
        await client.query('COMMIT');
        logger_1.logger.info('Payment status updated', {
            orderId: orderId,
            status,
            paymentMethod,
            amount: paymentAmount,
            totalAmountUpdated: newTotalAmount !== orderAmount,
            originalTotalAmount: orderAmount,
            finalTotalAmount: newTotalAmount,
            pricePerUnitChanged: pricePerUnit !== undefined,
            newPricePerUnit: pricePerUnit
        });
        // Invalidate cache after payment status update
        (0, cache_1.invalidateUserCache)(req.session.userId);
        // Emit WebSocket event to notify frontend about payment status change
        try {
            const io = global.io;
            if (io) {
                io.emit('order-status-updated', {
                    orderId: orderId,
                    paymentStatus: status,
                    newTotalAmount: newTotalAmount,
                    originalTotalAmount: orderAmount,
                    pricePerUnitChanged: pricePerUnit !== undefined,
                    newPricePerUnit: pricePerUnit,
                    timestamp: new Date().toISOString()
                });
                logger_1.logger.info('WebSocket event emitted for payment status update', { orderId: orderId, paymentStatus: status });
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not emit WebSocket event for payment update', { error: error instanceof Error ? error.message : String(error) });
        }
        res.json({
            message: 'Payment status updated successfully',
            orderId: orderId,
            newTotalAmount: newTotalAmount,
            originalTotalAmount: orderAmount,
            pricePerUnitChanged: pricePerUnit !== undefined,
            newPricePerUnit: pricePerUnit,
            invoiceCreationFailed: invoiceCreationFailed,
            invoiceCreationError: invoiceCreationError
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error updating payment status', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update payment status' });
    }
    finally {
        client.release();
    }
});
// Assign order to user
router.post('/assign', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { orderId, userId } = req.body;
        // Get admin info from session
        const userResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const { merchant_id: merchantId, role } = userResult.rows[0];
        if (role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can assign orders' });
        }
        await client.query('BEGIN');
        // Get current order status
        const currentOrder = await client.query('SELECT status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [orderId, merchantId]);
        if (currentOrder.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found' });
        }
        const oldStatus = currentOrder.rows[0].status;
        // Ensure order is confirmed before assignment
        if (oldStatus !== 'confirmed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Can only assign confirmed orders' });
        }
        // Update order with assigned user and set status to assigned
        await client.query('UPDATE oms.orders SET user_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE order_id = $3 AND merchant_id = $4', [userId, 'assigned', orderId, merchantId]);
        // Log status change from confirmed to assigned
        await client.query('INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)', [orderId, oldStatus, 'assigned', req.session.userId]);
        await client.query('COMMIT');
        logger_1.logger.info('Order assigned to user', { orderId, userId, assignedBy: req.session.userId });
        // Invalidate cache after order assignment
        (0, cache_1.invalidateUserCache)(req.session.userId);
        res.json({ message: 'Order assigned successfully' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error assigning order', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to assign order' });
    }
    finally {
        client.release();
    }
});
// Admin order status update
router.patch('/:id/status', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body;
        // Get user info from session
        const userResult = await client.query('SELECT merchant_id, role FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const { merchant_id: merchantId } = userResult.rows[0];
        // Validate status value using constants
        const validStatuses = Object.values(constants_1.ORDER_STATUS);
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }
        await client.query('BEGIN');
        // Get current status
        const currentOrder = await client.query('SELECT status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [id, merchantId]);
        if (currentOrder.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found' });
        }
        const oldStatus = currentOrder.rows[0].status;
        // Import status validation utilities for admin
        const { isValidEmployeeStatusTransition, getAllowedStatusTransitions } = await Promise.resolve().then(() => __importStar(require('./utils/status-validation')));
        // Validate status transition using business rules (same as employees)
        if (!isValidEmployeeStatusTransition(oldStatus, status)) {
            const allowedTransitions = getAllowedStatusTransitions(oldStatus);
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: `Invalid status transition from '${oldStatus}' to '${status}'. Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (final status)'}`
            });
        }
        // Prevent setting status to 'confirmed' unless payment is made
        if (status === 'confirmed') {
            const paymentResult = await client.query('SELECT payment_status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [id, merchantId]);
            if (paymentResult.rows.length > 0 && paymentResult.rows[0].payment_status !== 'paid') {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Please mark the order as paid first before confirming' });
            }
        }
        // Prevent setting status to 'shipped' unless payment is made
        if (status === 'shipped') {
            const paymentResult = await client.query('SELECT payment_status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [id, merchantId]);
            if (paymentResult.rows.length > 0 && paymentResult.rows[0].payment_status !== 'paid') {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Please mark the order as paid first before shipping' });
            }
        }
        // Prevent setting status to 'delivered' unless payment is made
        if (status === 'delivered') {
            const paymentResult = await client.query('SELECT payment_status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [id, merchantId]);
            if (paymentResult.rows.length > 0 && paymentResult.rows[0].payment_status !== 'paid') {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Please mark the order as paid first before marking as delivered' });
            }
        }
        // Prevent setting status to 'cancelled' unless payment is made
        if (status === 'cancelled') {
            const paymentResult = await client.query('SELECT payment_status FROM oms.orders WHERE order_id = $1 AND merchant_id = $2', [id, merchantId]);
            if (paymentResult.rows.length > 0 && paymentResult.rows[0].payment_status !== 'paid') {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Please mark the order as paid first before cancelling' });
            }
        }
        // Update order status
        await client.query('UPDATE oms.orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND merchant_id = $3', [status, id, merchantId]);
        // Log status change
        await client.query('INSERT INTO oms.order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)', [id, oldStatus, status, req.session.userId]);
        await client.query('COMMIT');
        // Invalidate cache after status update
        (0, cache_1.invalidateUserCache)(req.session.userId);
        logger_1.logger.info('Order status updated by admin', { orderId: id, status, userId: req.session.userId });
        res.json({ message: 'Order status updated successfully' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error updating order status', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to update order status' });
    }
    finally {
        client.release();
    }
});
// Return order endpoint
router.post('/return', async (req, res) => {
    const { order_id, customer_id, reason, return_items } = req.body;
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Validate required fields
        if (!order_id || !customer_id || !reason || !return_items || !Array.isArray(return_items)) {
            return res.status(400).json({ message: 'Missing required fields: order_id, customer_id, reason, return_items' });
        }
        // Check if order exists and get order details
        const orderResult = await client.query('SELECT order_id, status, total_amount, merchant_id FROM oms.orders WHERE order_id = $1 AND customer_id = $2', [order_id, customer_id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const order = orderResult.rows[0];
        // Check if order is in a valid state for return
        const validReturnStatuses = ['confirmed', 'delivered', 'assigned', 'shipped', 'cancelled'];
        if (!validReturnStatuses.includes(order.status)) {
            return res.status(400).json({
                message: `Order cannot be returned. Current status: ${order.status}. Valid statuses: ${validReturnStatuses.join(', ')}`
            });
        }
        // Check if return already exists for this order
        const existingReturnResult = await client.query('SELECT return_id FROM oms.order_returns WHERE order_id = $1', [order_id]);
        if (existingReturnResult.rows.length > 0) {
            return res.status(400).json({ message: 'Return request already exists for this order' });
        }
        // Calculate total return amount
        const totalReturnAmount = return_items.reduce((sum, item) => sum + item.total_amount, 0);
        // Create return record
        const returnResult = await client.query(`INSERT INTO oms.order_returns (
        order_id, customer_id, merchant_id, reason, total_refund_amount, 
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW()) 
      RETURNING return_id`, [order_id, customer_id, order.merchant_id, reason, totalReturnAmount]);
        const returnId = returnResult.rows[0].return_id;
        // Get order items for this order to find order_item_id and inventory_id
        const orderItemsResult = await client.query('SELECT order_item_id, product_id, inventory_id, quantity, price_per_unit, total_price FROM oms.order_items WHERE order_id = $1', [order_id]);
        if (orderItemsResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No order items found for this order' });
        }
        // Debug logging
        console.log('🔍 Order items found for return:', {
            orderId: order_id,
            orderItems: orderItemsResult.rows,
            returnItems: return_items
        });
        // Insert return items using the actual order items from database
        for (const dbItem of orderItemsResult.rows) {
            console.log('🔍 Processing order item:', dbItem);
            // Find the corresponding return item data (by product_id) - handle type conversion
            const returnItem = return_items.find(item => item.product_id === dbItem.product_id ||
                item.product_id === parseInt(dbItem.product_id) ||
                parseInt(item.product_id) === parseInt(dbItem.product_id));
            console.log('🔍 Found return item:', returnItem);
            if (returnItem) {
                // Get inventory_id from inventory table since it's not stored in order_items
                const inventoryResult = await client.query('SELECT inventory_id FROM oms.inventory WHERE merchant_id = $1 AND product_id = $2', [order.merchant_id, dbItem.product_id]);
                const inventoryId = inventoryResult.rows.length > 0 ? inventoryResult.rows[0].inventory_id : null;
                // Debug logging for return item insertion
                console.log('📝 Inserting return item:', {
                    returnId,
                    orderItemId: dbItem.order_item_id,
                    productId: dbItem.product_id,
                    inventoryId,
                    quantity: returnItem.quantity,
                    unitPrice: returnItem.unit_price,
                    totalAmount: returnItem.total_amount
                });
                await client.query(`INSERT INTO oms.order_return_items (
            return_id, order_item_id, product_id, inventory_id, 
            quantity, unit_price, total_amount, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`, [returnId, dbItem.order_item_id, dbItem.product_id, inventoryId,
                    returnItem.quantity, returnItem.unit_price, returnItem.total_amount]);
            }
        }
        // Update order status to 'returned' and add to status history
        await client.query('UPDATE oms.orders SET status = $1, updated_at = NOW() WHERE order_id = $2', ['returned', order_id]);
        // Add status history entry
        await client.query(`INSERT INTO oms.order_status_history (
        order_id, old_status, new_status, changed_at
      ) VALUES ($1, $2, $3, NOW())`, [order_id, order.status, 'returned']);
        await client.query('COMMIT');
        logger_1.logger.info(`Return request created successfully`, {
            returnId,
            orderId: order_id,
            customerId: customer_id,
            totalAmount: totalReturnAmount
        });
        res.json({
            message: 'Return request submitted successfully',
            return_id: returnId,
            total_return_amount: totalReturnAmount
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Error creating return request', error instanceof Error ? error.message : String(error));
        res.status(500).json({ message: 'Failed to create return request' });
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=orders.js.map
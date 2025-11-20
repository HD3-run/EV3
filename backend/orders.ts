import { Router, Request, Response } from 'express';
import { pool } from './db';
import { logger } from './utils/logger';
import { ORDER_STATUS, PAYMENT_METHODS, MESSAGES } from './utils/constants';
import { cacheMiddleware, invalidateUserCache } from './middleware/cache';
import { validatePagination, validateQuantity } from './middleware/validation';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

// Import extracted queries
import * as orderQueries from './orders/queries/order-queries';
import * as employeeQueries from './orders/queries/employee-queries';
import * as paymentQueries from './orders/queries/payment-queries';
import * as orderItemQueries from './orders/queries/order-item-queries';

// Import extracted services
import { createInvoiceFromPaidOrder } from './orders/services/invoiceService';
import { createManualOrder, updateOrderPrices } from './orders/services/orderService';
import { parseCSVOrders, processCSVUpload, emitErrorProgress } from './orders/services/csvService';
import { createReturnRequest } from './orders/services/returnService';
import { createBulkOrder } from './orders/services/bulkOrderService';
import { updateOrderStatus } from './orders/services/statusService';
import { updatePaymentStatus } from './orders/services/paymentService';
import { assignOrderToEmployee } from './orders/services/assignmentService';

// Declare global io type
declare global {
  var io: any;
}

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Get all orders with pagination and filtering
router.get('/', validatePagination, cacheMiddleware(30), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { page = 1, limit = 10, status, channel, search, date } = req.query;
    
    // Get user info from session
    const userInfoQuery = employeeQueries.getUserInfo((req as any).session.userId);
    const userResult = await client.query(userInfoQuery.query, userInfoQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      logger.error('User not found in orders endpoint', {
        userId: (req as any).session.userId,
        sessionId: req.sessionID
      });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId, role } = userResult.rows[0];
    
    if (process.env.NODE_ENV === 'development') {
      logger.info('Orders endpoint called', {
        userId: (req as any).session.userId,
        role: role,
        merchantId: merchantId,
        queryParams: { page, limit, status, channel, search }
      });
    }
    
    // Use extracted query builder
    const ordersQuery = orderQueries.getOrdersQuery({
      merchantId,
      userId: (req as any).session.userId,
      role,
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      channel: channel as string,
      search: search as string,
      date: date as string
    });

    if (process.env.NODE_ENV === 'development') {
      logger.info('Executing orders query', {
        query: ordersQuery.query.replace(/\s+/g, ' '),
        params: ordersQuery.queryParams
      });
    }

    const result = await client.query(ordersQuery.query, ordersQuery.queryParams);
    
    // Log query results for debugging, especially for assigned filter
    if (process.env.NODE_ENV === 'development' || status === 'assigned') {
      const rowCount = result.rows.length;
      const totalCount = result.rows[0]?.total_count || 0;
      logger.info(`Orders query result - status: ${status}, page: ${page}, limit: ${limit}, rowCount: ${rowCount}, totalCount: ${totalCount}`);
      if (status === 'assigned') {
        logger.info(`Assigned orders query - Found ${rowCount} rows out of ${totalCount} total assigned orders`);
        if (rowCount < totalCount && rowCount < Number(limit)) {
          logger.warn(`⚠️ WARNING: Query returned ${rowCount} rows but total is ${totalCount}. This suggests a query issue.`);
        }
        // Log first few order IDs to verify they have user_id
        const sampleOrderIds = result.rows.slice(0, 5).map((r: any) => ({
          order_id: r.order_id,
          user_id: r.user_id,
          status: r.status
        }));
        logger.info(`Sample assigned orders: ${JSON.stringify(sampleOrderIds)}`);
      }
    }
    
    const limitNum = Number(limit) || 10;
    const totalCount = result.rows[0]?.total_count || 0;
    const actualRowCount = result.rows.length;
    
    // Additional logging for assigned filter
    if (status === 'assigned') {
      logger.info(`📊 Assigned filter response - Returning ${actualRowCount} orders, total count: ${totalCount}, limit: ${limitNum}, page: ${page}`);
      if (actualRowCount < totalCount && actualRowCount < limitNum) {
        logger.warn(`⚠️ POTENTIAL ISSUE: Only ${actualRowCount} rows returned but total is ${totalCount} and limit is ${limitNum}`);
      }
    }
    
    const response = {
      orders: result.rows,
      pagination: {
        page: Number(page),
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    };

    if (process.env.NODE_ENV === 'development') {
      (response as any).debug = {
        queryParams: { page, limit, status, channel, search },
        userRole: role,
        merchantId,
        userId: (req as any).session.userId,
        userIdType: typeof (req as any).session.userId,
        queryExecuted: ordersQuery.query.replace(/\s+/g, ' '),
        params: ordersQuery.queryParams,
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
  } catch (error) {
    logger.error('Error fetching orders', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: (req as any).session.userId,
      query: req.query,
      path: req.path
    });
    res.status(500).json({ 
      message: 'Failed to fetch orders',
      debug: process.env.NODE_ENV === 'development' ? {
        error: error instanceof Error ? error.message : String(error)
      } : undefined
    });
  } finally {
    client.release();
  }
});

// Add manual order endpoint
router.post('/add-manual', validateQuantity, async (req: Request, res: Response) => {
  logger.info('Manual order creation request', { body: req.body, userId: (req as any).session.userId });
  
  const client = await pool.connect();
  try {
    // Get merchant ID from current user session
    const merchantQuery = employeeQueries.getMerchantId((req as any).session.userId);
    const userResult = await client.query(merchantQuery.query, merchantQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      logger.error('User not found for manual order', { userId: (req as any).session.userId });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    await client.query('BEGIN');
    
    // Use extracted service
    const completeOrder = await createManualOrder(
      client,
      (req as any).session.userId,
      merchantId,
      req.body
    );

    await client.query('COMMIT');

    // Invalidate cache after creating order
    invalidateUserCache((req as any).session.userId);

    // Send WebSocket notification for live updates
    if (global.io) {
      global.io.emit('orderCreated', {
        type: 'orderCreated',
        order: completeOrder,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Manual order created successfully', {
      orderId: completeOrder.order_id,
      customerName: completeOrder.customer_name,
      displayAmount: completeOrder.display_amount,
      orderItemsCount: completeOrder.order_items ? completeOrder.order_items.length : 0,
      orderItems: completeOrder.order_items
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(201).json(completeOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error creating manual order', errorMessage);
    res.status(500).json({ message: errorMessage.includes('not found') || errorMessage.includes('Insufficient') ? errorMessage : 'Failed to create order' });
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } finally {
    client.release();
  }
});

// Create new order
router.post('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    // Get merchant ID from current user session
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    await client.query('BEGIN');
    
    const { channel, items, totalAmount } = req.body;

    // Use extracted service
    const completeOrder = await createBulkOrder(
      client,
      merchantId,
      (req as any).session.userId,
      { channel, items, totalAmount }
    );

    await client.query('COMMIT');

    // Invalidate cache after creating order
    invalidateUserCache((req as any).session.userId);

    // Send WebSocket notification for live updates
    if (global.io) {
      global.io.emit('orderCreated', {
        type: 'orderCreated',
        order: completeOrder,
        timestamp: new Date().toISOString()
      });
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(201).json(completeOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating order', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to create order' });
  } finally {
    client.release();
  }
});



// CSV upload endpoint
router.post('/upload-csv', upload.single('file'), async (req: Request, res: Response) => {
  logger.info('POST /api/orders/upload-csv - Request received', { 
    fileName: req.file?.originalname,
    fileSize: req.file?.size,
    userId: (req as any).session?.userId,
    sessionExists: !!(req as any).session
  });
  
  const client = await pool.connect();
  // Use uploadId from request if provided, otherwise generate one
  const uploadId = req.body.uploadId || `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    if (!req.file) {
      logger.error('No file uploaded');
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get merchant ID from current user session
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    logger.info('User lookup for CSV upload', { userFound: userResult.rows.length > 0, userId: (req as any).session.userId });
    
    if (userResult.rows.length === 0) {
      logger.error('User not found for CSV upload', { userId: (req as any).session.userId });
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    logger.info('Processing CSV for merchant', { merchantId });

    // Parse CSV using extracted service
    const { orders, errors: parseErrors } = await parseCSVOrders(req.file.buffer);

    if (orders.length === 0) {
      return res.status(400).json({ message: 'No valid orders found in CSV', errors: parseErrors });
    }

    await client.query('BEGIN');
    
    // Process CSV upload using extracted service (handles batching and WebSocket progress)
    const result = await processCSVUpload(
      client,
      orders,
      merchantId,
      (req as any).session.userId,
      uploadId
    );
    
    await client.query('COMMIT');
    
    // Invalidate user cache after CSV upload to ensure fresh data
    invalidateUserCache((req as any).session.userId);
    
    res.json({
      message: `Successfully processed ${result.created} orders using BATCH PROCESSING`,
      created: result.created,
      errors: result.errors.length,
      errorDetails: result.errors,
      uploadId: uploadId,
      batchProcessing: true,
      processingMethod: 'Batch Processing (500 orders per batch)'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error processing CSV upload', error instanceof Error ? error.message : String(error));
    
    // Emit error progress event
    emitErrorProgress(uploadId, error instanceof Error ? error.message : String(error));
    
    res.status(500).json({ message: 'Failed to process CSV upload', error: error instanceof Error ? error.message : String(error) });
  } finally {
    client.release();
  }
});

// Create sample data for testing
router.post('/create-sample', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const userResult = await client.query(
      'SELECT merchant_id FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    await client.query('BEGIN');
    
    // Create sample customer
    const customerResult = await client.query(
      'INSERT INTO oms.customers (merchant_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id',
      [merchantId, 'Sample Customer', '+1234567890', 'customer@example.com', '123 Sample Street']
    );
    
    const customerId = customerResult.rows[0].customer_id;
    
    // Create sample product (database will auto-generate SKU)
    const productResult = await client.query(
      'INSERT INTO oms.products (merchant_id, product_name, category) VALUES ($1, $2, $3) RETURNING product_id, sku',
      [merchantId, 'Sample Product', 'Electronics']
    );
    
    const productId = productResult.rows[0].product_id;
    const sampleSku = productResult.rows[0].sku; // Fetch auto-generated SKU from database
    
    // Create sample inventory
    const inventoryResult = await client.query(
      'INSERT INTO oms.inventory (merchant_id, product_id, quantity_available, reorder_level) VALUES ($1, $2, $3, $4) RETURNING inventory_id',
      [merchantId, productId, 100, 10]
    );
    
    const inventoryId = inventoryResult.rows[0].inventory_id;
    
    // Create sample order
    const orderResult = await client.query(
      'INSERT INTO oms.orders (merchant_id, customer_id, order_source, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [merchantId, customerId, 'Manual', 99.99, 'pending']
    );
    
    const orderId = orderResult.rows[0].order_id;
    
    // Create order item
    const sampleTotalPrice = 1 * 99.99; // quantity * unitPrice
    await client.query(
      'INSERT INTO oms.order_items (order_id, product_id, inventory_id, sku, quantity, price_per_unit, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [orderId, productId, inventoryId, sampleSku, 1, 99.99, sampleTotalPrice]
    );
    
    await client.query('COMMIT');
    
    res.json({ message: 'Sample data created successfully', orderId, productId, customerId });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating sample data', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to create sample data' });
  } finally {
    client.release();
  }
});

// Debug endpoint - only available in development
if (process.env.NODE_ENV === 'development') {
  router.get('/debug', async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT merchant_id, role, username FROM oms.users WHERE user_id = $1',
        [(req as any).session.userId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({ message: MESSAGES.USER_NOT_FOUND });
      }
      
      const { merchant_id: merchantId, role, username } = userResult.rows[0];
      
      // Enhanced debug information
      const [ordersCount, assignedCount, usersCount, productsCount, specificAssignedOrders] = await Promise.all([
        client.query('SELECT COUNT(*) as total FROM oms.orders WHERE merchant_id = $1', [merchantId]),
        client.query('SELECT COUNT(*) as assigned FROM oms.orders WHERE merchant_id = $1 AND user_id = $2', [merchantId, (req as any).session.userId]),
        client.query('SELECT user_id, username, role FROM oms.users WHERE merchant_id = $1', [merchantId]),
        client.query('SELECT COUNT(*) as total FROM oms.products WHERE merchant_id = $1', [merchantId]),
        client.query('SELECT o.order_id, o.order_source, o.total_amount, o.status, o.created_at, c.name as customer_name FROM oms.orders o LEFT JOIN oms.customers c ON o.customer_id = c.customer_id WHERE o.merchant_id = $1 AND o.user_id = $2', [merchantId, (req as any).session.userId])
      ]);
      
      res.json({
        user: { role, merchantId, userId: (req as any).session.userId, username },
        data: {
          totalOrders: ordersCount.rows[0].total,
          assignedOrders: assignedCount.rows[0].assigned,
          totalProducts: productsCount.rows[0].total
        },
        assignedOrderDetails: specificAssignedOrders.rows,
        allUsers: usersCount.rows,
        sessionInfo: {
          sessionId: req.sessionID,
          hasSession: !!(req as any).session,
          sessionUserId: (req as any).session?.userId,
          sessionUserIdType: typeof (req as any).session?.userId
        }
      });
    } catch (error) {
      logger.error('Debug endpoint error', error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: 'Debug failed', error: error instanceof Error ? error.message : String(error) });
    } finally {
      client.release();
    }
  });
}

// Update order item prices
router.patch('/:id/price', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { pricePerUnit } = req.body;

    if (pricePerUnit === undefined || pricePerUnit < 0) {
      return res.status(400).json({ message: 'Valid price_per_unit is required and must be non-negative' });
    }

    // Get user info from session
    const userInfoQuery = employeeQueries.getUserInfo((req as any).session.userId);
    const userResult = await client.query(userInfoQuery.query, userInfoQuery.queryParams);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { merchant_id: merchantId, role } = userResult.rows[0];

    // Only admins can update prices
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update order prices' });
    }

    await client.query('BEGIN');

    // Check if order exists
    const orderQuery = orderQueries.checkOrderExists(parseInt(id), merchantId);
    const orderResult = await client.query(orderQuery.query, orderQuery.queryParams);

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }

    const originalOrderAmount = parseFloat(orderResult.rows[0].total_amount);

    logger.info('Updating order item prices', {
      orderId: id,
      newPricePerUnit: pricePerUnit,
      originalOrderAmount: originalOrderAmount
    });

    // Use extracted service
    const newTotalAmount = await updateOrderPrices(client, parseInt(id), merchantId, pricePerUnit);

    await client.query('COMMIT');

    logger.info('Order prices updated successfully', {
      orderId: id,
      newPricePerUnit: pricePerUnit,
      originalOrderAmount: originalOrderAmount,
      newTotalAmount: newTotalAmount,
      note: 'total_price and total_amount recalculated based on new unit price'
    });

    // Invalidate cache after price update
    invalidateUserCache((req as any).session.userId);

    res.json({
      message: 'Order prices updated successfully',
      orderId: id,
      newPricePerUnit: pricePerUnit,
      originalTotalAmount: originalOrderAmount,
      newTotalAmount: newTotalAmount,
      note: 'total_price and total_amount recalculated based on new unit price'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating order prices', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to update order prices' });
  } finally {
    client.release();
  }
});

// Update payment status
router.patch('/:id/payment', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const orderId = parseInt(id, 10); // Ensure it's a number
    console.log('🔍 Payment update request for order ID:', orderId, 'type:', typeof orderId);

    const { status, paymentMethod, amount, pricePerUnit } = req.body;

    // Get user info from session
    const userResult = await client.query(
      'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { merchant_id: merchantId } = userResult.rows[0];

    await client.query('BEGIN');

    // Use extracted service
    const result = await updatePaymentStatus(
      client,
      orderId,
      merchantId,
      (req as any).session.userId,
      { status, paymentMethod, amount, pricePerUnit }
    );

    await client.query('COMMIT');
    
    // Invalidate cache after payment status update
    invalidateUserCache((req as any).session.userId);

    // Emit WebSocket event to notify frontend about payment status change
    try {
      const io = (global as any).io;
      if (io) {
        io.emit('order-status-updated', {
          orderId: orderId,
          paymentStatus: status,
          newTotalAmount: result.newTotalAmount,
          originalTotalAmount: result.originalTotalAmount,
          pricePerUnitChanged: result.pricePerUnitChanged,
          newPricePerUnit: result.newPricePerUnit,
          timestamp: new Date().toISOString()
        });
        logger.info('WebSocket event emitted for payment status update', { orderId: orderId, paymentStatus: status });
      }
    } catch (error) {
      logger.warn('Could not emit WebSocket event for payment update', { error: error instanceof Error ? error.message : String(error) });
    }

    // Emit WebSocket event for auto-created invoice if applicable
    if (result.invoiceCreated && result.invoiceId) {
      try {
        const io = (global as any).io;
        if (io) {
          io.emit('invoice-auto-created', {
            orderId: orderId,
            invoiceId: result.invoiceId,
            invoiceNumber: result.invoiceNumber,
            displayNumber: result.displayNumber,
            totalAmount: result.totalAmount,
            timestamp: new Date().toISOString()
          });
          console.log('📡 WebSocket event emitted for auto-created invoice:', result.displayNumber);
        }
      } catch (wsError) {
        console.log('⚠️ Could not emit WebSocket event for auto-created invoice:', wsError);
      }
    }

    res.json({
      message: 'Payment status updated successfully',
      orderId: orderId,
      newTotalAmount: result.newTotalAmount,
      originalTotalAmount: result.originalTotalAmount,
      pricePerUnitChanged: result.pricePerUnitChanged,
      newPricePerUnit: result.newPricePerUnit,
      invoiceCreationFailed: result.invoiceCreationFailed,
      invoiceCreationError: result.invoiceCreationError
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating payment status', error instanceof Error ? error.message : String(error));
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ message: errorMessage });
  } finally {
    client.release();
  }
});

// Assign order to user
router.post('/assign', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { orderId, userId } = req.body;
    
    // Get admin info from session
    const userResult = await client.query(
      'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId, role } = userResult.rows[0];
    
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can assign orders' });
    }
    
    await client.query('BEGIN');
    
    // Use extracted service
    await assignOrderToEmployee(
      client,
      orderId,
      merchantId,
      (req as any).session.userId,
      userId
    );
    
    await client.query('COMMIT');
    
    // Invalidate cache after order assignment
    invalidateUserCache((req as any).session.userId);
    
    res.json({ message: 'Order assigned successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error assigning order', error instanceof Error ? error.message : String(error));
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ message: errorMessage });
  } finally {
    client.release();
  }
});

// Admin order status update
router.patch('/:id/status', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Get user info from session
    const userResult = await client.query(
      'SELECT merchant_id, role FROM oms.users WHERE user_id = $1',
      [(req as any).session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const { merchant_id: merchantId } = userResult.rows[0];
    
    await client.query('BEGIN');
    
    // Use extracted service
    await updateOrderStatus(
      client,
      parseInt(id),
      merchantId,
      (req as any).session.userId,
      status
    );
    
    await client.query('COMMIT');
    
    // Invalidate cache after status update
    invalidateUserCache((req as any).session.userId);
    
    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating order status', error instanceof Error ? error.message : String(error));
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ message: errorMessage });
  } finally {
    client.release();
  }
});

// Return order endpoint
router.post('/return', async (req: Request, res: Response) => {
  const { order_id, customer_id, reason, return_items } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Validate required fields
    if (!order_id || !customer_id || !reason || !return_items || !Array.isArray(return_items)) {
      return res.status(400).json({ message: 'Missing required fields: order_id, customer_id, reason, return_items' });
    }

    // Get merchant ID from order
    const orderQuery = orderQueries.checkOrderExists(order_id, 0); // We'll get merchant_id from order
    const orderResult = await client.query(
      'SELECT order_id, status, total_amount, merchant_id FROM oms.orders WHERE order_id = $1 AND customer_id = $2',
      [order_id, customer_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Use extracted service
    const returnResult = await createReturnRequest(
      client,
      order_id,
      customer_id,
      reason,
      return_items,
      order.merchant_id
    );

    await client.query('COMMIT');

    logger.info(`Return request created successfully`, {
      returnId: returnResult.returnId,
      orderId: order_id,
      customerId: customer_id,
      totalAmount: returnResult.totalReturnAmount
    });

    res.json({ 
      message: 'Return request submitted successfully',
      return_id: returnResult.returnId,
      total_return_amount: returnResult.totalReturnAmount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error creating return request', errorMessage);
    res.status(500).json({ message: errorMessage.includes('not found') || errorMessage.includes('cannot be returned') || errorMessage.includes('already exists') ? errorMessage : 'Failed to create return request' });
  } finally {
    client.release();
  }
});


export default router;
import { Router, Request, Response } from 'express';
import { pool, getPoolMetrics } from './db';
import { logger } from './utils/logger';
import { poolProtectionMiddleware } from './middleware/pool-protection';
import { publicOrderLimiter } from './middleware/rate-limit';
import { createPublicOrder, PublicOrderData } from './public-orders/services/order-creation-service';

const router = Router();

// Apply global rate limiting and pool protection to public orders
// This prevents 100 people ordering simultaneously from overwhelming the system
router.use('/create', publicOrderLimiter, poolProtectionMiddleware);

// Public order creation endpoint (no authentication required)
// This endpoint is used by customers ordering from public catalog
router.post('/create', async (req: Request, res: Response) => {
  logger.info('Public order creation request', { body: req.body });
  
  // Check pool status before attempting connection (double-check)
  const poolMetrics = getPoolMetrics();
  const activeConnections = poolMetrics.totalCount - poolMetrics.idleCount;
  const utilization = activeConnections / 90; // 90 is max pool size
  
  if (utilization >= 0.95) {
    logger.warn('Rejecting public order - pool exhausted', {
      utilization: `${(utilization * 100).toFixed(1)}%`,
      activeConnections,
      idleConnections: poolMetrics.idleCount,
      waitingRequests: poolMetrics.waitingCount
    });
    return res.status(503).json({
      success: false,
      message: 'System is currently under heavy load. Please try again in a few moments.',
      retryAfter: 30
    });
  }
  
  const client = await pool.connect();
  try {
    const { 
      merchantId,
      customerName, 
      customerPhone, 
      customerEmail, 
      addressLine1, 
      addressLine2, 
      landmark, 
      city, 
      state, 
      pincode, 
      country, 
      alternatePhone, 
      deliveryNote, 
      items, // Array of { productId, quantity, unitPrice }
      orderSource = 'catalog',
      state_code,
      gst_number
    } = req.body;

    // Validate required fields
    if (!merchantId || !customerName || !customerPhone || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: merchantId, customerName, customerPhone, and items are required' 
      });
    }

    await client.query('BEGIN');

    // Prepare order data
    const orderData: PublicOrderData = {
      merchantId: parseInt(merchantId),
      customerName,
      customerPhone,
      customerEmail,
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
      country,
      alternatePhone,
      deliveryNote,
      orderSource,
      stateCode: state_code,
      gstNumber: gst_number,
      items
    };

    // Create order using service
    const createdOrder = await createPublicOrder(client, orderData);

    await client.query('COMMIT');

    logger.info('Public order created successfully', { 
      orderId: createdOrder.order_id, 
      merchantId: orderData.merchantId,
      customerId: createdOrder.customer_id,
      totalAmount: createdOrder.total_amount
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: createdOrder
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Merchant not found') {
        return res.status(404).json({ 
          success: false,
          message: 'Merchant not found' 
        });
      }
      
      if (error.message.includes('not found') || error.message.includes("doesn't belong")) {
        return res.status(404).json({ 
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('Insufficient stock')) {
        return res.status(400).json({ 
          success: false,
          message: error.message
        });
      }
    }
    
    logger.error('Error creating public order', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      success: false,
      message: 'Failed to create order',
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    client.release();
  }
});

export default router;


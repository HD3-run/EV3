import { Router, Request, Response } from 'express';
import { pool } from './db';
import { logger } from './utils/logger';
import { authenticateUser } from './middleware/auth';

// Import queries from orders/queries (keeping them there as requested)
import * as employeeQueries from './orders/queries/employee-queries';

// Import services
import { updateEmployeeOrderStatus } from './employee/services/statusService';

const router = Router();

// All employee routes require authentication
router.use(authenticateUser);

// Get assigned orders (shipped status)
router.get('/assigned-orders', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = parseInt((req as any).session.userId, 10);
    const query = employeeQueries.getAssignedOrdersQuery(userId);
    const result = await client.query(query.query, query.queryParams);
    
    res.json({ orders: result.rows });
  } catch (error) {
    logger.error('Error fetching assigned orders', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch assigned orders' });
  } finally {
    client.release();
  }
});

// Get all employee orders
router.get('/orders', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = parseInt((req as any).session.userId, 10);
    const query = employeeQueries.getEmployeeOrdersQuery(userId);
    const result = await client.query(query.query, query.queryParams);
    
    res.json({ orders: result.rows });
  } catch (error) {
    logger.error('Error fetching employee orders', error instanceof Error ? error.message : String(error));
    res.status(500).json({ message: 'Failed to fetch orders' });
  } finally {
    client.release();
  }
});

// Update order status
router.put('/orders/:orderId/status', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = parseInt((req as any).session.userId, 10);
    
    logger.info('PUT /api/employee/orders/:orderId/status', { orderId, status, userId });
    
    await client.query('BEGIN');
    
    // Get user role
    const roleQuery = employeeQueries.getUserRoleQuery(userId);
    const userResult = await client.query(roleQuery.query, roleQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userRole = userResult.rows[0].role;
    
    // Update status using service
    await updateEmployeeOrderStatus(client, parseInt(orderId, 10), userId, status, userRole);
    
    await client.query('COMMIT');
    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating order status', error instanceof Error ? error.message : String(error));
    res.status(error instanceof Error && error.message.includes('Invalid') ? 400 : 500).json({ 
      message: error instanceof Error ? error.message : 'Failed to update order status' 
    });
  } finally {
    client.release();
  }
});

export default router;


import { Router, Request, Response } from 'express';
import { pool } from './db';
import { logger } from './utils/logger';
import { sanitizeForLog } from './middleware/validation';

// Import extracted queries
import * as userQueries from './reports/queries/user-queries';
import * as dashboardQueries from './reports/queries/dashboard-queries';

// Import extracted services
import { generateReport } from './reports/services/reportService';
import { getDashboardMetrics } from './reports/services/dashboardService';
import { calculateKPIs } from './reports/services/kpiService';
import { getSalesReport } from './reports/services/salesService';
import { exportSalesToCSV } from './reports/services/exportService';

const router = Router();

// Get reports data
router.get('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { type = 'daily', startDate, endDate } = req.query;
    
    // Get user merchant ID
    const userQuery = userQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Generate report using service
    const formattedData = await generateReport(
      client,
      merchantId,
      type as 'daily' | 'monthly' | 'yearly',
      startDate as string | undefined,
      endDate as string | undefined
    );
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ data: formattedData });
  } catch (error) {
    logger.error('Error fetching reports data', sanitizeForLog(error instanceof Error ? error.message : String(error)));
    res.status(500).json({ message: 'Failed to fetch reports data' });
  } finally {
    client.release();
  }
});

// Get dashboard metrics
router.get('/dashboard', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log('🔍 Dashboard API - Getting metrics for date:', today);
    console.log('👤 Session userId:', sanitizeForLog((req as any).session?.userId));

    // Get merchant ID from session user
    const userQuery = userQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);

    console.log('👤 User lookup result:', userResult.rows);

    if (userResult.rows.length === 0) {
      console.error('❌ User not found for dashboard metrics');
      return res.status(401).json({ message: 'User not found' });
    }

    const merchantId = userResult.rows[0].merchant_id;
    console.log('🏪 Merchant ID:', merchantId);

    // Get dashboard metrics using service
    const metrics = await getDashboardMetrics(client, merchantId);

    console.log('📦 Final dashboard metrics:', metrics);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching dashboard metrics', sanitizeForLog(error instanceof Error ? error.message : String(error)));
    res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
  } finally {
    client.release();
  }
});

// Get advanced KPIs
router.get('/kpis', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    console.log('🔍 KPIs API - Getting advanced metrics');
    console.log('👤 Session userId:', sanitizeForLog((req as any).session?.userId));

    // Get user merchant ID
    const userQuery = userQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const merchantId = userResult.rows[0].merchant_id;
    console.log('🏪 Merchant ID:', merchantId);

    // Calculate KPIs using service
    const kpis = await calculateKPIs(client, merchantId);

    console.log('📊 KPIs calculated:', kpis);

    res.json(kpis);
  } catch (error) {
    logger.error('Error fetching KPIs', sanitizeForLog(error instanceof Error ? error.message : String(error)));
    res.status(500).json({ message: 'Failed to fetch KPIs' });
  } finally {
    client.release();
  }
});

// Debug endpoint for dashboard data
router.get('/debug-dashboard', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    console.log('🔍 Debug Dashboard - Session userId:', sanitizeForLog((req as any).session?.userId));

    // Get user with merchant ID
    const userQuery = userQueries.getUserWithMerchantQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);

    if (userResult.rows.length === 0) {
      return res.json({ error: 'User not found', sessionUserId: (req as any).session?.userId });
    }

    const user = userResult.rows[0];
    console.log('👤 Debug user:', user);

    // Get debug data using queries
    const today = new Date().toISOString().split('T')[0];
    const ordersQuery = dashboardQueries.getDebugOrdersQuery(user.merchant_id);
    const productsQuery = dashboardQueries.getDebugProductsQuery(user.merchant_id);
    const lowStockQuery = dashboardQueries.getDebugLowStockQuery(user.merchant_id);
    const totalStockQuery = dashboardQueries.getDebugTotalStockQuery(user.merchant_id);
    const todayOrdersQuery = dashboardQueries.getDebugTodayOrdersQuery(user.merchant_id, today);

    const [
      ordersResult,
      productsResult,
      lowStockResult,
      totalStockResult,
      todayOrdersResult
    ] = await Promise.all([
      client.query(ordersQuery.query, ordersQuery.queryParams),
      client.query(productsQuery.query, productsQuery.queryParams),
      client.query(lowStockQuery.query, lowStockQuery.queryParams),
      client.query(totalStockQuery.query, totalStockQuery.queryParams),
      client.query(todayOrdersQuery.query, todayOrdersQuery.queryParams)
    ]);

    console.log('📊 Debug data:', {
      user,
      orders: ordersResult.rows[0],
      products: productsResult.rows[0],
      lowStock: lowStockResult.rows[0],
      totalStock: totalStockResult.rows[0],
      todayOrders: todayOrdersResult.rows[0]
    });

    res.json({
      user: userResult.rows[0],
      totalOrders: ordersResult.rows[0].total_orders,
      pendingOrders: ordersResult.rows[0].pending_orders,
      totalProducts: productsResult.rows[0].total_products,
      totalStock: parseInt(totalStockResult.rows[0].total_stock),
      todayOrders: todayOrdersResult.rows[0].today_orders,
      todayRevenue: todayOrdersResult.rows[0].today_revenue,
      debugDate: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in debug dashboard', sanitizeForLog(error instanceof Error ? error.message : String(error)));
    res.status(500).json({ message: 'Failed to debug dashboard' });
  } finally {
    client.release();
  }
});

// Get sales report
router.get('/sales', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { startDate, endDate, channel, groupBy = 'day' } = req.query;
    
    // Get user merchant ID
    const userQuery = userQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Get sales report using service
    const salesData = await getSalesReport(
      client,
      merchantId,
      startDate as string | undefined,
      endDate as string | undefined,
      channel as string | undefined,
      groupBy as 'day' | 'week' | 'month'
    );
    
    res.json(salesData);
  } catch (error) {
    logger.error('Error fetching sales report', sanitizeForLog(error instanceof Error ? error.message : String(error)));
    res.status(500).json({ message: 'Failed to fetch sales report' });
  } finally {
    client.release();
  }
});

// Export sales data as CSV
router.get('/export/sales', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { startDate, endDate, channel } = req.query;
    
    // Get user merchant ID
    const userQuery = userQueries.getUserMerchantIdQuery((req as any).session.userId);
    const userResult = await client.query(userQuery.query, userQuery.queryParams);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    const merchantId = userResult.rows[0].merchant_id;
    
    // Export sales data using service
    const csvData = await exportSalesToCSV(
      client,
      merchantId,
      startDate as string | undefined,
      endDate as string | undefined,
      channel as string | undefined
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
    res.send(csvData);
  } catch (error) {
    logger.error('Error exporting sales data', sanitizeForLog(error instanceof Error ? error.message : String(error)));
    res.status(500).json({ message: 'Failed to export sales data' });
  } finally {
    client.release();
  }
});

export default router;

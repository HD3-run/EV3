"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("./db");
const logger_1 = require("./utils/logger");
const validation_1 = require("./middleware/validation");
const router = (0, express_1.Router)();
// Get reports data
router.get('/', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { type = 'daily', startDate, endDate } = req.query;
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        let query = '';
        let params = [merchantId];
        if (type === 'daily') {
            query = `
        SELECT 
          DATE(o.order_date) as date,
          COUNT(o.order_id) as sales,
          COALESCE(SUM(o.total_amount), 0) as revenue
        FROM oms.orders o
        WHERE o.merchant_id = $1
        AND o.payment_status = 'paid'
        AND o.status != 'returned'
      `;
            if (startDate && endDate) {
                query += ` AND DATE(o.order_date) BETWEEN $2 AND $3`;
                params.push(startDate, endDate);
            }
            else {
                query += ` AND DATE(o.order_date) >= CURRENT_DATE - INTERVAL '30 days'`;
            }
            query += ` GROUP BY DATE(o.order_date) ORDER BY DATE(o.order_date) DESC`;
        }
        else if (type === 'monthly') {
            query = `
        SELECT 
          TO_CHAR(o.order_date, 'YYYY-MM') as date,
          COUNT(o.order_id) as sales,
          COALESCE(SUM(o.total_amount), 0) as revenue
        FROM oms.orders o
        WHERE o.merchant_id = $1
        AND o.payment_status = 'paid'
        AND o.status != 'returned'
      `;
            if (startDate && endDate) {
                query += ` AND TO_CHAR(o.order_date, 'YYYY-MM') BETWEEN $2 AND $3`;
                params.push(startDate, endDate);
            }
            else {
                query += ` AND o.order_date >= CURRENT_DATE - INTERVAL '12 months'`;
            }
            query += ` GROUP BY TO_CHAR(o.order_date, 'YYYY-MM') ORDER BY TO_CHAR(o.order_date, 'YYYY-MM') DESC`;
        }
        else if (type === 'yearly') {
            query = `
        SELECT 
          EXTRACT(YEAR FROM o.order_date)::text as date,
          COUNT(o.order_id) as sales,
          COALESCE(SUM(o.total_amount), 0) as revenue
        FROM oms.orders o
        WHERE o.merchant_id = $1
        AND o.payment_status = 'paid'
        AND o.status != 'returned'
        GROUP BY EXTRACT(YEAR FROM o.order_date)
        ORDER BY EXTRACT(YEAR FROM o.order_date) DESC
      `;
        }
        const result = await client.query(query, params);
        const formattedData = result.rows.map(row => ({
            date: row.date,
            sales: parseInt(row.sales) || 0,
            revenue: parseFloat(row.revenue) || 0
        }));
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ data: formattedData });
    }
    catch (error) {
        logger_1.logger.error('Error fetching reports data', (0, validation_1.sanitizeForLog)(error instanceof Error ? error.message : String(error)));
        res.status(500).json({ message: 'Failed to fetch reports data' });
    }
    finally {
        client.release();
    }
});
// Get dashboard metrics
router.get('/dashboard', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log('🔍 Dashboard API - Getting metrics for date:', today);
        console.log('👤 Session userId:', (0, validation_1.sanitizeForLog)(req.session?.userId));
        // Get merchant ID from session user
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        console.log('👤 User lookup result:', userResult.rows);
        if (userResult.rows.length === 0) {
            console.error('❌ User not found for dashboard metrics');
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        console.log('🏪 Merchant ID:', merchantId);
        const todayOrdersResult = await client.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
      FROM oms.orders
      WHERE DATE(created_at) = $1 AND merchant_id = $2 AND status != 'returned'
    `, [today, merchantId]);
        console.log('📊 Today orders result:', todayOrdersResult.rows[0]);
        const pendingOrdersResult = await client.query(`
      SELECT COUNT(*) as count
      FROM oms.orders
      WHERE payment_status = 'pending' AND merchant_id = $1
    `, [merchantId]);
        console.log('📊 Pending orders result (payment_status = pending):', pendingOrdersResult.rows[0]);
        const lowStockResult = await client.query(`
      SELECT COUNT(*) as count
      FROM oms.inventory i
      JOIN oms.products p ON i.product_id = p.product_id
      WHERE i.quantity_available <= i.reorder_level AND p.merchant_id = $1
    `, [merchantId]);
        console.log('📊 Low stock result:', lowStockResult.rows[0]);
        // Get total products and total stock
        const productsResult = await client.query(`
      SELECT
        COUNT(*) as total_products,
        COALESCE(SUM(i.quantity_available), 0) as total_stock
      FROM oms.products p
      JOIN oms.inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = $1
    `, [merchantId]);
        console.log('📊 Products result:', productsResult.rows[0]);
        // Get returns data
        const returnsResult = await client.query(`
      SELECT 
        COUNT(*) as total_returns,
        COALESCE(SUM(total_refund_amount), 0) as total_return_amount
      FROM oms.order_returns
      WHERE merchant_id = $1
    `, [merchantId]);
        console.log('📊 Returns result:', returnsResult.rows[0]);
        // OPTIMIZED: Use indexed columns and better date filtering (excluding returned orders)
        const monthlyRevenueResult = await client.query(`
      SELECT
        DATE_TRUNC('month', created_at) as month,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
      FROM oms.orders
      WHERE merchant_id = $1 
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
        AND payment_status = 'paid'
        AND status != 'returned'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `, [merchantId]);
        console.log('📊 Monthly revenue result:', monthlyRevenueResult.rows);
        // OPTIMIZED: Better filtering and use of indexes (excluding returned orders)
        const channelPerformanceResult = await client.query(`
      SELECT
        order_source as channel,
        COUNT(*) as orders,
        SUM(total_amount) as revenue
      FROM oms.orders
      WHERE merchant_id = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND payment_status = 'paid'
        AND status != 'returned'
      GROUP BY order_source
    `, [merchantId]);
        console.log('📊 Channel performance result:', channelPerformanceResult.rows);
        // Get adjusted COGS (excluding returned orders)
        const adjustedCOGSResult = await client.query(`
      SELECT COALESCE(SUM(oi.quantity * i.cost_price), 0) as total_cogs
      FROM oms.order_items oi
      JOIN oms.orders o ON oi.order_id = o.order_id
      JOIN oms.inventory i ON oi.inventory_id = i.inventory_id
      WHERE o.merchant_id = $1 
        AND o.payment_status = 'paid'
        AND o.status != 'returned'
    `, [merchantId]);
        console.log('📊 Adjusted COGS result:', adjustedCOGSResult.rows[0]);
        // Get top selling products (excluding returned orders)
        const topProductsResult = await client.query(`
      SELECT 
        p.product_name,
        p.sku,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.total_price) as revenue
      FROM oms.order_items oi
      JOIN oms.orders o ON oi.order_id = o.order_id
      JOIN oms.products p ON oi.product_id = p.product_id
      WHERE o.merchant_id = $1 
        AND o.payment_status = 'paid'
        AND o.status != 'returned'
      GROUP BY p.product_id, p.product_name, p.sku
      ORDER BY quantity_sold DESC
      LIMIT 10
    `, [merchantId]);
        console.log('📊 Top products result:', topProductsResult.rows);
        const totalOrders = monthlyRevenueResult.rows.reduce((sum, month) => sum + parseInt(month.orders), 0);
        const totalRevenue = monthlyRevenueResult.rows.reduce((sum, month) => sum + parseFloat(month.revenue), 0);
        const adjustedCOGS = parseFloat(adjustedCOGSResult.rows[0].total_cogs);
        console.log('📊 Calculated totals - Orders:', totalOrders, 'Revenue:', totalRevenue);
        // Calculate adjusted KPIs
        const grossProfit = totalRevenue - adjustedCOGS;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const metrics = {
            todayOrders: parseInt(todayOrdersResult.rows[0].count),
            todayRevenue: parseFloat(todayOrdersResult.rows[0].revenue),
            pendingOrders: parseInt(pendingOrdersResult.rows[0].count),
            lowStockProducts: parseInt(lowStockResult.rows[0].count),
            totalOrders,
            totalRevenue,
            totalProducts: parseInt(productsResult.rows[0].total_products),
            totalStock: parseInt(productsResult.rows[0].total_stock),
            totalReturns: parseInt(returnsResult.rows[0].total_returns),
            totalReturnAmount: parseFloat(returnsResult.rows[0].total_return_amount),
            // Adjusted KPIs
            adjustedCOGS,
            grossProfit,
            profitMargin,
            averageOrderValue,
            monthlyRevenue: monthlyRevenueResult.rows,
            channelPerformance: channelPerformanceResult.rows,
            topSellingProducts: topProductsResult.rows
        };
        console.log('📦 Final dashboard metrics:', metrics);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(metrics);
    }
    catch (error) {
        logger_1.logger.error('Error fetching dashboard metrics', (0, validation_1.sanitizeForLog)(error instanceof Error ? error.message : String(error)));
        res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
    }
    finally {
        client.release();
    }
});
// Get advanced KPIs
router.get('/kpis', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        console.log('🔍 KPIs API - Getting advanced metrics');
        console.log('👤 Session userId:', (0, validation_1.sanitizeForLog)(req.session?.userId));
        const userResult = await client.query('SELECT merchant_id FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        console.log('🏪 Merchant ID:', merchantId);
        // 1. Get Total Revenue and Total Orders for AOV calculation (excluding returned orders)
        const revenueOrdersResult = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM oms.orders
      WHERE merchant_id = $1 AND payment_status = 'paid' AND status != 'returned'
    `, [merchantId]);
        const totalOrders = parseInt(revenueOrdersResult.rows[0].total_orders);
        const totalRevenue = parseFloat(revenueOrdersResult.rows[0].total_revenue);
        // 2. Get Cost of Goods Sold (COGS) from order_items (excluding returned orders)
        const cogsResult = await client.query(`
      SELECT 
        COALESCE(SUM(oi.quantity * i.cost_price), 0) as total_cogs
      FROM oms.order_items oi
      JOIN oms.orders o ON oi.order_id = o.order_id
      JOIN oms.inventory i ON oi.product_id = i.product_id
      WHERE o.merchant_id = $1 AND o.payment_status = 'paid' AND o.status != 'returned'
    `, [merchantId]);
        const totalCOGS = parseFloat(cogsResult.rows[0].total_cogs);
        // 3. Calculate Gross Profit and Profit Margin
        const grossProfit = totalRevenue - totalCOGS;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        // 4. Calculate Average Order Value (AOV)
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        // 5. Get Top-selling Products (excluding returned orders)
        const topProductsResult = await client.query(`
      SELECT 
        pr.product_name,
        pr.sku,
        SUM(oi.quantity) as total_quantity_sold,
        SUM(oi.total_price) as total_revenue
      FROM oms.order_items oi
      JOIN oms.orders o ON oi.order_id = o.order_id
      JOIN oms.products pr ON oi.product_id = pr.product_id
      WHERE o.merchant_id = $1 AND o.payment_status = 'paid' AND o.status != 'returned'
      GROUP BY pr.product_id, pr.product_name, pr.sku
      ORDER BY total_quantity_sold DESC
      LIMIT 5
    `, [merchantId]);
        // 6. Get Top-performing Sales Channels (excluding returned orders)
        const topChannelsResult = await client.query(`
      SELECT 
        order_source as channel,
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        ROUND(AVG(total_amount), 2) as avg_order_value
      FROM oms.orders
      WHERE merchant_id = $1 AND payment_status = 'paid' AND status != 'returned'
      GROUP BY order_source
      ORDER BY total_revenue DESC
      LIMIT 5
    `, [merchantId]);
        const kpis = {
            grossProfit: Math.round(grossProfit * 100) / 100,
            profitMargin: Math.round(profitMargin * 100) / 100,
            averageOrderValue: Math.round(averageOrderValue * 100) / 100,
            adjustedCOGS: Math.round(totalCOGS * 100) / 100,
            topSellingProducts: topProductsResult.rows.map(product => ({
                product_name: product.product_name,
                sku: product.sku,
                quantity_sold: parseInt(product.total_quantity_sold),
                revenue: parseFloat(product.total_revenue)
            })),
            topChannels: topChannelsResult.rows.map(channel => ({
                channel: channel.channel,
                orders: parseInt(channel.total_orders),
                revenue: parseFloat(channel.total_revenue),
                avgOrderValue: parseFloat(channel.avg_order_value)
            })),
            summary: {
                totalRevenue,
                totalCOGS,
                totalOrders
            }
        };
        console.log('📊 KPIs calculated:', kpis);
        res.json(kpis);
    }
    catch (error) {
        logger_1.logger.error('Error fetching KPIs', (0, validation_1.sanitizeForLog)(error instanceof Error ? error.message : String(error)));
        res.status(500).json({ message: 'Failed to fetch KPIs' });
    }
    finally {
        client.release();
    }
});
// Debug endpoint for dashboard data
router.get('/debug-dashboard', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        console.log('🔍 Debug Dashboard - Session userId:', (0, validation_1.sanitizeForLog)(req.session?.userId));
        const userResult = await client.query('SELECT user_id, merchant_id, username FROM oms.users WHERE user_id = $1', [req.session.userId]);
        if (userResult.rows.length === 0) {
            return res.json({ error: 'User not found', sessionUserId: req.session?.userId });
        }
        const user = userResult.rows[0];
        console.log('👤 Debug user:', user);
        // Count orders for this merchant
        const ordersResult = await client.query('SELECT COUNT(*) as total_orders, COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_orders FROM oms.orders WHERE merchant_id = $1', [user.merchant_id]);
        // Count products
        const productsResult = await client.query('SELECT COUNT(*) as total_products FROM oms.products WHERE merchant_id = $1', [user.merchant_id]);
        // Count low stock products
        const lowStockResult = await client.query(`
      SELECT COUNT(*) as low_stock_count
      FROM oms.inventory i
      JOIN oms.products p ON i.product_id = p.product_id
      WHERE i.quantity_available <= i.reorder_level AND p.merchant_id = $1
    `, [user.merchant_id]);
        // Get total stock (sum of all quantities)
        const totalStockResult = await client.query(`
      SELECT COALESCE(SUM(i.quantity_available), 0) as total_stock
      FROM oms.inventory i
      JOIN oms.products p ON i.product_id = p.product_id
      WHERE p.merchant_id = $1
    `, [user.merchant_id]);
        // Get today's orders
        const today = new Date().toISOString().split('T')[0];
        const todayOrdersResult = await client.query(`
      SELECT COUNT(*) as today_orders, COALESCE(SUM(total_amount), 0) as today_revenue
      FROM oms.orders
      WHERE DATE(created_at) = $1 AND merchant_id = $2
    `, [today, user.merchant_id]);
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
    }
    catch (error) {
        logger_1.logger.error('Error in debug dashboard', (0, validation_1.sanitizeForLog)(error instanceof Error ? error.message : String(error)));
        res.status(500).json({ message: 'Failed to debug dashboard' });
    }
    finally {
        client.release();
    }
});
// Get sales report
router.get('/sales', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { startDate, endDate, channel, groupBy = 'day' } = req.query;
        let dateFormat = 'YYYY-MM-DD';
        let dateTrunc = 'day';
        if (groupBy === 'month') {
            dateFormat = 'YYYY-MM';
            dateTrunc = 'month';
        }
        else if (groupBy === 'week') {
            dateFormat = 'YYYY-"W"WW';
            dateTrunc = 'week';
        }
        let query = `
      SELECT 
        DATE_TRUNC('${dateTrunc}', created_at) as period,
        TO_CHAR(DATE_TRUNC('${dateTrunc}', created_at), '${dateFormat}') as period_label,
        COUNT(*) as orders,
        SUM(total_amount) as revenue,
        AVG(total_amount) as avg_order_value
      FROM oms.orders 
      WHERE status != 'returned'
    `;
        const params = [];
        let paramIndex = 1;
        if (startDate) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        if (channel && channel !== 'all') {
            query += ` AND channel = $${paramIndex}`;
            params.push(channel);
            paramIndex++;
        }
        query += ` GROUP BY DATE_TRUNC('${dateTrunc}', created_at) ORDER BY period`;
        const result = await client.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        logger_1.logger.error('Error fetching sales report', (0, validation_1.sanitizeForLog)(error instanceof Error ? error.message : String(error)));
        res.status(500).json({ message: 'Failed to fetch sales report' });
    }
    finally {
        client.release();
    }
});
// Export sales data as CSV
router.get('/export/sales', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { startDate, endDate, channel } = req.query;
        let query = `
      SELECT 
        order_number,
        customer_name,
        customer_email,
        channel,
        status,
        total_amount,
        created_at
      FROM oms.orders 
      WHERE status != 'returned'
    `;
        const params = [];
        let paramIndex = 1;
        if (startDate) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        if (channel && channel !== 'all') {
            query += ` AND channel = $${paramIndex}`;
            params.push(channel);
            paramIndex++;
        }
        query += ` ORDER BY created_at DESC`;
        const result = await client.query(query, params);
        // Convert to CSV
        const headers = ['Order Number', 'Customer Name', 'Email', 'Channel', 'Status', 'Amount', 'Date'];
        const csvData = [
            headers.join(','),
            ...result.rows.map((row) => [
                row.order_number,
                row.customer_name,
                row.customer_email,
                row.channel,
                row.status,
                row.total_amount,
                new Date(row.created_at).toISOString().split('T')[0]
            ].join(','))
        ].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
        res.send(csvData);
    }
    catch (error) {
        logger_1.logger.error('Error exporting sales data', (0, validation_1.sanitizeForLog)(error instanceof Error ? error.message : String(error)));
        res.status(500).json({ message: 'Failed to export sales data' });
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map
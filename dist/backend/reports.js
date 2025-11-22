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
const validation_1 = require("./middleware/validation");
// Import extracted queries
const userQueries = __importStar(require("./reports/queries/user-queries"));
const dashboardQueries = __importStar(require("./reports/queries/dashboard-queries"));
// Import extracted services
const reportService_1 = require("./reports/services/reportService");
const dashboardService_1 = require("./reports/services/dashboardService");
const kpiService_1 = require("./reports/services/kpiService");
const salesService_1 = require("./reports/services/salesService");
const exportService_1 = require("./reports/services/exportService");
const router = (0, express_1.Router)();
// Get reports data
router.get('/', async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { type = 'daily', startDate, endDate } = req.query;
        // Get user merchant ID
        const userQuery = userQueries.getUserMerchantIdQuery(req.session.userId);
        const userResult = await client.query(userQuery.query, userQuery.queryParams);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        // Generate report using service
        const formattedData = await (0, reportService_1.generateReport)(client, merchantId, type, startDate, endDate);
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
        const userQuery = userQueries.getUserMerchantIdQuery(req.session.userId);
        const userResult = await client.query(userQuery.query, userQuery.queryParams);
        console.log('👤 User lookup result:', userResult.rows);
        if (userResult.rows.length === 0) {
            console.error('❌ User not found for dashboard metrics');
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        console.log('🏪 Merchant ID:', merchantId);
        // Get dashboard metrics using service
        const metrics = await (0, dashboardService_1.getDashboardMetrics)(client, merchantId);
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
        // Get user merchant ID
        const userQuery = userQueries.getUserMerchantIdQuery(req.session.userId);
        const userResult = await client.query(userQuery.query, userQuery.queryParams);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        console.log('🏪 Merchant ID:', merchantId);
        // Calculate KPIs using service
        const kpis = await (0, kpiService_1.calculateKPIs)(client, merchantId);
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
        // Get user with merchant ID
        const userQuery = userQueries.getUserWithMerchantQuery(req.session.userId);
        const userResult = await client.query(userQuery.query, userQuery.queryParams);
        if (userResult.rows.length === 0) {
            return res.json({ error: 'User not found', sessionUserId: req.session?.userId });
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
        const [ordersResult, productsResult, lowStockResult, totalStockResult, todayOrdersResult] = await Promise.all([
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
        // Get user merchant ID
        const userQuery = userQueries.getUserMerchantIdQuery(req.session.userId);
        const userResult = await client.query(userQuery.query, userQuery.queryParams);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        // Get sales report using service
        const salesData = await (0, salesService_1.getSalesReport)(client, merchantId, startDate, endDate, channel, groupBy);
        res.json(salesData);
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
        // Get user merchant ID
        const userQuery = userQueries.getUserMerchantIdQuery(req.session.userId);
        const userResult = await client.query(userQuery.query, userQuery.queryParams);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }
        const merchantId = userResult.rows[0].merchant_id;
        // Export sales data using service
        const csvData = await (0, exportService_1.exportSalesToCSV)(client, merchantId, startDate, endDate, channel);
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
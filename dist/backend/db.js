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
exports.pool = void 0;
exports.getPoolMetrics = getPoolMetrics;
exports.getEmergencyConnection = getEmergencyConnection;
exports.executeQueryWithMonitoring = executeQueryWithMonitoring;
const pg_1 = require("pg");
const logger_js_1 = require("./utils/logger.js");
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 90, // Increased for better concurrency and high load handling
    min: 10, // Keep more connections ready to reduce connection overhead
    idleTimeoutMillis: 30000, // 30 seconds - connections idle longer than this are closed
    connectionTimeoutMillis: 10000, // 10 seconds to establish new connection
    statement_timeout: 10000, // 10 second query timeout
    query_timeout: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: 'oms-backend-optimized'
});
exports.pool = pool;
pool.on('error', (err) => {
    logger_js_1.logger.error('Unexpected error on idle client', err.message);
    // Don't exit process, let it retry
});
// Add connection retry logic
pool.on('connect', () => {
    logger_js_1.logger.info('Database connected successfully');
});
pool.on('remove', () => {
    logger_js_1.logger.info('Database connection removed from pool');
});
// Connection pool metrics for monitoring
function getPoolMetrics() {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
    };
}
// Emergency fallback for when pool is exhausted
async function getEmergencyConnection() {
    const { Client } = await Promise.resolve().then(() => __importStar(require('pg')));
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    return client;
}
// Query performance monitoring wrapper
async function executeQueryWithMonitoring(query, params = [], context = 'unknown') {
    const startTime = Date.now();
    try {
        const result = await pool.query(query, params);
        const duration = Date.now() - startTime;
        // Log slow queries (> 1 second)
        if (duration > 1000) {
            logger_js_1.logger.warn('Slow query detected', {
                context,
                duration: `${duration}ms`,
                query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
                paramCount: params.length
            });
        }
        // Log very slow queries (> 5 seconds)
        if (duration > 5000) {
            logger_js_1.logger.error('Very slow query detected', {
                context,
                duration: `${duration}ms`,
                query: query.substring(0, 500) + (query.length > 500 ? '...' : ''),
                params: params.slice(0, 5) // Log first 5 params only
            });
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_js_1.logger.error('Query execution failed', {
            context,
            duration: `${duration}ms`,
            error: error instanceof Error ? error.message : String(error),
            query: query.substring(0, 200) + (query.length > 200 ? '...' : '')
        });
        throw error;
    }
}
exports.default = pool;
//# sourceMappingURL=db.js.map
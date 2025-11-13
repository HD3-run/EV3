import { Pool } from 'pg';
import { logger } from './utils/logger.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 90,  // Increased for better concurrency and high load handling
  min: 10,   // Keep more connections ready to reduce connection overhead
  idleTimeoutMillis: 30000, // 30 seconds - connections idle longer than this are closed
  connectionTimeoutMillis: 10000, // 10 seconds to establish new connection
  statement_timeout: 10000, // 10 second query timeout
  query_timeout: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  application_name: 'oms-backend-optimized'
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err.message);
  // Don't exit process, let it retry
});

// Add connection retry logic
pool.on('connect', () => {
  logger.info('Database connected successfully');
});

pool.on('remove', () => {
  logger.info('Database connection removed from pool');
});

// Connection pool metrics for monitoring
export function getPoolMetrics() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

// Emergency fallback for when pool is exhausted
export async function getEmergencyConnection() {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

// Query performance monitoring wrapper
export async function executeQueryWithMonitoring(query: string, params: any[] = [], context: string = 'unknown') {
  const startTime = Date.now();
  
  try {
    const result = await pool.query(query, params);
    const duration = Date.now() - startTime;
    
    // Log slow queries (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        context,
        duration: `${duration}ms`,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        paramCount: params.length
      });
    }
    
    // Log very slow queries (> 5 seconds)
    if (duration > 5000) {
      logger.error('Very slow query detected', {
        context,
        duration: `${duration}ms`,
        query: query.substring(0, 500) + (query.length > 500 ? '...' : ''),
        params: params.slice(0, 5) // Log first 5 params only
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query execution failed', {
      context,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 200) + (query.length > 200 ? '...' : '')
    });
    throw error;
  }
}

export default pool;
export { pool };

/**
 * Connection Pool Protection Middleware
 * Prevents accepting new requests when connection pool is exhausted
 * This protects the system from being overwhelmed by too many concurrent database operations
 */

import { Request, Response, NextFunction } from 'express';
import { getPoolMetrics } from '../db';
import { logger } from '../utils/logger';

// Thresholds for pool protection
const POOL_WARNING_THRESHOLD = 0.8; // 80% of connections in use
const POOL_CRITICAL_THRESHOLD = 0.95; // 95% of connections in use
const MAX_POOL_SIZE = 90; // Should match db.ts max value

/**
 * Middleware to check connection pool status before processing requests
 * Returns 503 Service Unavailable if pool is critically exhausted
 */
export function poolProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const metrics = getPoolMetrics();
    const { totalCount, idleCount, waitingCount } = metrics;
    
    // Calculate pool utilization
    const activeConnections = totalCount - idleCount;
    const utilization = activeConnections / MAX_POOL_SIZE;
    
    // Log pool status for monitoring
    if (utilization > POOL_WARNING_THRESHOLD) {
      logger.warn('Connection pool utilization high', {
        utilization: `${(utilization * 100).toFixed(1)}%`,
        activeConnections,
        idleConnections: idleCount,
        waitingRequests: waitingCount,
        totalConnections: totalCount,
        path: req.path
      });
    }
    
    // Reject requests if pool is critically exhausted
    if (utilization >= POOL_CRITICAL_THRESHOLD) {
      logger.error('Connection pool critically exhausted - rejecting request', {
        utilization: `${(utilization * 100).toFixed(1)}%`,
        activeConnections,
        idleConnections: idleCount,
        waitingRequests: waitingCount,
        path: req.path,
        method: req.method
      });
      
      return res.status(503).json({
        success: false,
        message: 'System is currently under heavy load. Please try again in a few moments.',
        retryAfter: 30, // Suggest retry after 30 seconds
        error: 'SERVICE_UNAVAILABLE'
      });
    }
    
    // Allow request to proceed
    next();
  } catch (error) {
    // If we can't check pool status, log error but allow request (fail open)
    logger.error('Error checking pool status', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path
    });
    next();
  }
}

/**
 * Get current pool status for monitoring/debugging
 */
export function getPoolStatus() {
  try {
    const metrics = getPoolMetrics();
    const { totalCount, idleCount, waitingCount } = metrics;
    const activeConnections = totalCount - idleCount;
    const utilization = activeConnections / MAX_POOL_SIZE;
    
    return {
      totalConnections: totalCount,
      activeConnections,
      idleConnections: idleCount,
      waitingRequests: waitingCount,
      utilization: `${(utilization * 100).toFixed(1)}%`,
      status: utilization >= POOL_CRITICAL_THRESHOLD 
        ? 'CRITICAL' 
        : utilization >= POOL_WARNING_THRESHOLD 
        ? 'WARNING' 
        : 'HEALTHY'
    };
  } catch (error) {
    return {
      error: 'Unable to fetch pool status',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}


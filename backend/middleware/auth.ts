/**
 * Authentication and authorization middleware
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { logger } from '../utils/logger';
import { MESSAGES, USER_ROLES } from '../utils/constants';
import { cache } from './cache';

// Extend Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: number;
        merchant_id: number;
        username: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate user and attach user data to request
 * Supports both phantom token (Authorization header) and session-based auth
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    let userId: number | undefined;
    let authMethod = 'none';
    
    // Try phantom token authentication first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const phantomToken = authHeader.substring(7);
      
      try {
        const { resolvePhantomToken, validateJWT } = await import('../utils/jwt');
        const tokenData = resolvePhantomToken(phantomToken);
        
        if (tokenData) {
          const decoded = validateJWT(tokenData.jwt);
          if (decoded && decoded.sub) {
            userId = decoded.sub;
            authMethod = 'phantom_token';
          }
        }
      } catch (error) {
        logger.warn('Phantom token validation failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Fallback to session-based auth
    if (!userId) {
      userId = (req as any).session?.userId;
      if (userId) {
        authMethod = 'session';
      }
    }
    
    // Enhanced debugging for development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Authentication Debug', {
        path: req.path,
        method: req.method,
        authMethod,
        userId,
        hasAuthHeader: !!authHeader,
        hasSession: !!(req as any).session,
        sessionId: req.sessionID
      });
    }
    
    if (!userId) {
      logger.error('Authentication failed - no valid credentials', {
        authMethod,
        hasAuthHeader: !!authHeader,
        sessionExists: !!(req as any).session,
        path: req.path,
        method: req.method
      });
      return res.status(401).json({ 
        message: 'Authentication required',
        debug: process.env.NODE_ENV === 'development' ? {
          authMethod,
          hasAuthHeader: !!authHeader,
          sessionExists: !!(req as any).session,
          path: req.path
        } : undefined
      });
    }
    
    // Try cache first
    const cacheKey = `user_${userId}`;
    let userData = cache.get(cacheKey);
    
    if (!userData) {
      const client = await pool.connect();
      
      try {
        const userResult = await client.query(
          'SELECT user_id, merchant_id, username, email, role FROM oms.users WHERE user_id = $1',
          [userId]
        );
        
        if (userResult.rows.length === 0) {
          logger.error('User not found in database', {
            userId: userId,
            userIdType: typeof userId,
            path: req.path
          });
          return res.status(401).json({ 
            message: MESSAGES.USER_NOT_FOUND,
            debug: process.env.NODE_ENV === 'development' ? {
              userId: userId,
              userIdType: typeof userId
            } : undefined
          });
        }
        
        userData = userResult.rows[0];
        // Cache for 5 minutes
        cache.set(cacheKey, userData, 300);
        
        if (process.env.NODE_ENV === 'development') {
          logger.info('User data loaded from database', {
            userId: userData.user_id,
            role: userData.role,
            merchantId: userData.merchant_id,
            username: userData.username
          });
        }
        
      } finally {
        client.release();
      }
    } else if (process.env.NODE_ENV === 'development') {
      logger.info('User data loaded from cache', {
        userId: userData.user_id,
        role: userData.role,
        merchantId: userData.merchant_id,
        username: userData.username
      });
    }
    
    req.user = userData;
    next();
    
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      userId: (req as any).session?.userId,
      sessionId: req.sessionID
    });
    res.status(500).json({ 
      message: MESSAGES.INTERNAL_ERROR,
      debug: process.env.NODE_ENV === 'development' ? {
        error: error instanceof Error ? error.message : String(error)
      } : undefined
    });
  }
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: MESSAGES.UNAUTHORIZED });
    }
    
    next();
  };
}

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole(USER_ROLES.ADMIN);

/**
 * Middleware to check if user is admin or manager
 */
export const requireAdminOrManager = requireRole([USER_ROLES.ADMIN, USER_ROLES.MANAGER]);

/**
 * Middleware to validate session exists
 */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).session || !(req as any).session.userId) {
    return res.status(401).json({ message: 'Session required' });
  }
  next();
}
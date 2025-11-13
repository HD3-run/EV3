import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Session validation middleware
export const validateSession = (req: Request, res: Response, next: NextFunction) => {
  // Skip validation for auth endpoints
  if (req.path.includes('/auth/') || req.path === '/api/auth/login' || req.path === '/api/auth/register') {
    return next();
  }
  
  const session = (req as any).session;
  
  // Only validate if session exists and has user data
  if (session && session.user && session.userId) {
    // Check session expiry if set
    if (session.expires && new Date() > new Date(session.expires)) {
      session.destroy((err: any) => {
        if (err) logger.error('Session destruction error', err);
      });
      return res.status(401).json({ message: 'Session expired' });
    }
  }
  
  next();
};

// Short-lived token refresh
export const refreshSession = (req: Request, _res: Response, next: NextFunction) => {
  // Skip refresh for auth endpoints
  if (req.path.includes('/auth/') || req.path === '/api/auth/login' || req.path === '/api/auth/register') {
    return next();
  }
  
  const session = (req as any).session;
  
  if (session && session.userId) {
    // Refresh session expiry (30 minutes from now)
    session.expires = new Date(Date.now() + 30 * 60 * 1000);
  }
  
  next();
};
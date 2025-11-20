import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Account lockout tracking
const failedAttempts = new Map<string, { count: number; lockUntil?: number }>();

// Enhanced input sanitization with XSS protection
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/[<>"'&]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .trim();
    }
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  next();
};

// SQL injection protection
export const sanitizeForSQL = (input: string): string => {
  if (typeof input !== 'string') return input;
  return input.replace(/[';"\\]/g, '');
};

// Log sanitization to prevent log injection
export const sanitizeForLog = (input: any): string => {
  if (typeof input === 'object') {
    input = JSON.stringify(input);
  }
  return String(input).replace(/[\r\n\t]/g, '_');
};

// Password complexity validation
export const validatePassword = (req: Request, res: Response, next: NextFunction) => {
  const { password } = req.body;
  if (!password) return next();
  
  const errors = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain lowercase letter');
  if (!/\d/.test(password)) errors.push('Password must contain number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('Password must contain special character');
  
  if (errors.length > 0) {
    return res.status(400).json({ message: 'Password requirements not met', errors });
  }
  next();
};

// Account lockout middleware
export const checkAccountLockout = (req: Request, res: Response, next: NextFunction) => {
  const id = req.body.email || req.body.username || req.ip;
  const attempts = failedAttempts.get(id);
  
  if (attempts?.lockUntil && Date.now() < attempts.lockUntil) {
    const mins = Math.ceil((attempts.lockUntil - Date.now()) / 60000);
    return res.status(423).json({ message: `Account locked. Try again in ${mins} minutes.` });
  }
  next();
};

// Track failed attempts
export const trackFailedLogin = (identifier: string) => {
  const attempts = failedAttempts.get(identifier) || { count: 0 };
  attempts.count += 1;
  
  if (attempts.count >= 5) {
    attempts.lockUntil = Date.now() + (15 * 60 * 1000);
    logger.warn('Account locked', { identifier, attempts: attempts.count });
  }
  
  failedAttempts.set(identifier, attempts);
};

// Clear failed attempts
export const clearFailedAttempts = (identifier: string) => {
  failedAttempts.delete(identifier);
};

// Pagination validation
export const validatePagination = (req: Request, _res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  if (page < 1) req.query.page = '1';
  if (limit < 1) req.query.limit = '20';
  
  next();
};

// Quantity validation
export const validateQuantity = (req: Request, res: Response, next: NextFunction) => {
  if (req.body.quantity !== undefined) {
    const quantity = parseInt(req.body.quantity);
    if (isNaN(quantity) || quantity < 0) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }
    req.body.quantity = quantity;
  }
  next();
};

// Enhanced URL manipulation protection
export const preventUrlManipulation = (req: Request, res: Response, next: NextFunction) => {
  const url = req.url;
  const suspicious = ['%2e', '..', '%2f', '%5c', '\\', '%00', 'etc/passwd', 'cmd.exe'];
  
  if (suspicious.some(pattern => url.toLowerCase().includes(pattern))) {
    logger.warn('Suspicious URL detected', { url, ip: req.ip });
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

// Security event logging
export const logSecurityEvents = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      logger.warn('Security event', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        userAgent: req.get('User-Agent')
      });
    }
    return originalSend.call(this, data);
  };
  next();
};

// Cleanup expired lockouts
setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of failedAttempts.entries()) {
    if (attempts.lockUntil && now > attempts.lockUntil) {
      failedAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);
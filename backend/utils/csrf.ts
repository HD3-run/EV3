import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || 'your-csrf-secret-change-in-production';

export function generateCSRFToken(req: Request): string {
  if (!req.session['csrfSecret']) {
    req.session['csrfSecret'] = crypto.randomBytes(32).toString('hex');
  }
  const token = crypto.createHmac('sha256', CSRF_SECRET)
    .update(req.session['csrfSecret'] as string)
    .digest('hex');
  return token;
}

export function verifyCSRFToken(req: Request, token: string): boolean {
  if (!req.session['csrfSecret'] || !token) {
    return false;
  }
  const expectedToken = crypto.createHmac('sha256', CSRF_SECRET)
    .update(req.session['csrfSecret'] as string)
    .digest('hex');
  
  // Use crypto.timingSafeEqual for secure comparison
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');
  const tokenBuffer = Buffer.from(token, 'utf8');
  
  if (expectedBuffer.length !== tokenBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    // For GET requests, just generate a token and attach it to locals
    res.locals.csrfToken = generateCSRFToken(req);
    return next();
  }

  const token = req.body._csrf || req.headers['x-csrf-token'];
  if (!token || !verifyCSRFToken(req, token)) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  next();
}
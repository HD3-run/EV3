import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// CSRF token storage
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Generate CSRF token
export const generateCSRFToken = (sessionId: string): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + (60 * 60 * 1000); // 1 hour
  
  console.log('🔑 Storing CSRF token for session:', sessionId);
  csrfTokens.set(sessionId, { token, expires });
  console.log('📦 Total stored tokens:', csrfTokens.size);
  return token;
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const sessionId = req.sessionID;
  const clientToken = req.headers['x-csrf-token'] as string;
  const storedData = csrfTokens.get(sessionId);
  
  // Enhanced logging for CSRF validation
  console.log('🔒 CSRF Validation:', {
    sessionId: sessionId,
    clientToken: clientToken ? 'present' : 'missing',
    storedToken: storedData ? 'present' : 'missing',
    expired: storedData ? Date.now() > storedData.expires : 'no-token',
    totalStoredTokens: csrfTokens.size
  });
  
  if (!storedData) {
    console.log('❌ CSRF: No stored token for session');
    return res.status(403).json({ message: 'CSRF token required' });
  }
  
  if (Date.now() > storedData.expires) {
    console.log('❌ CSRF: Token expired');
    csrfTokens.delete(sessionId);
    return res.status(403).json({ message: 'CSRF token expired' });
  }
  
  if (!clientToken) {
    console.log('❌ CSRF: No client token provided');
    return res.status(403).json({ message: 'CSRF token missing from request' });
  }
  
  if (clientToken !== storedData.token) {
    console.log('❌ CSRF: Token mismatch');
    return res.status(403).json({ message: 'CSRF token invalid' });
  }
  
  console.log('✅ CSRF: Token validated successfully');
  next();
};

// Endpoint to get CSRF token
export const getCSRFToken = (req: Request, res: Response) => {
  // Ensure session is saved before generating token
  (req as any).session.save((err: any) => {
    if (err) {
      console.log('❌ Session save error:', err);
      return res.status(500).json({ message: 'Session error' });
    }
    
    const sessionId = req.sessionID;
    console.log('🔑 Generating CSRF token for session:', sessionId);
    
    if (!sessionId) {
      console.log('❌ No session ID available for CSRF token generation');
      return res.status(400).json({ message: 'Session required for CSRF token' });
    }
    
    const token = generateCSRFToken(sessionId);
    console.log('✅ CSRF token generated successfully');
    res.json({ csrfToken: token });
  });
};

// Cleanup expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of csrfTokens.entries()) {
    if (now > data.expires) {
      csrfTokens.delete(key);
    }
  }
}, 5 * 60 * 1000);
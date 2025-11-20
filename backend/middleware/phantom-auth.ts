import { Request, Response, NextFunction } from 'express';
import { resolvePhantomToken, validateJWT } from '../utils/jwt.js';

// Phantom token authentication middleware
export const phantomAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const phantomToken = authHeader.substring(7);
  
  // Resolve phantom token to JWT
  const tokenData = resolvePhantomToken(phantomToken);
  
  if (!tokenData) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  
  // Validate the actual JWT
  const decoded = validateJWT(tokenData.jwt);
  
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid JWT' });
  }
  
  // Attach user data to request
  (req as any).user = {
    userId: decoded.sub,
    role: decoded.role,
    merchant_id: decoded.merchant_id
  };
  
  next();
};
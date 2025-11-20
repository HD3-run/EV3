import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from './logger.js';

// Refresh token storage
const refreshTokens = new Map<string, { userId: number; expiresAt: number }>();

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'ecommitra-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ecommitra-client';

// Phantom token storage (in production, use Redis)
const phantomTokens = new Map<string, any>();

// Generate opaque phantom token
export const generatePhantomToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Create JWT with shorter lifetime
export const createJWT = (payload: any): string => {
  const sanitizedPayload = {
    sub: payload.userId,
    role: payload.role,
    merchant_id: payload.merchant_id,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 minutes
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(sanitizedPayload, JWT_SECRET, { algorithm: 'HS256' });
};

// Create refresh token
export const createRefreshToken = (userId: number): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  
  refreshTokens.set(token, { userId, expiresAt });
  return token;
};

// Validate refresh token
export const validateRefreshToken = (token: string): number | null => {
  const data = refreshTokens.get(token);
  if (!data || Date.now() > data.expiresAt) {
    refreshTokens.delete(token);
    return null;
  }
  return data.userId;
};

// Revoke refresh token
export const revokeRefreshToken = (token: string): void => {
  refreshTokens.delete(token);
};

// Validate JWT with issuer/audience checks
export const validateJWT = (token: string): any => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'] // Don't trust algo header
    });
    return decoded;
  } catch (error) {
    logger.warn('JWT validation failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

// Phantom token pattern implementation
export const createPhantomTokenPair = (userPayload: any) => {
  const phantomToken = generatePhantomToken();
  const jwt = createJWT(userPayload);
  
  // Store JWT reference with phantom token
  phantomTokens.set(phantomToken, {
    jwt,
    userPayload,
    createdAt: Date.now(),
    expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes
  });
  
  return { phantomToken, jwt };
};

// Resolve phantom token to JWT
export const resolvePhantomToken = (phantomToken: string) => {
  const tokenData = phantomTokens.get(phantomToken);
  
  if (!tokenData) {
    return null;
  }
  
  // Check expiry
  if (Date.now() > tokenData.expiresAt) {
    phantomTokens.delete(phantomToken);
    return null;
  }
  
  return tokenData;
};

// Cleanup expired tokens
setInterval(() => {
  const now = Date.now();
  // Cleanup phantom tokens
  for (const [token, data] of phantomTokens.entries()) {
    if (now > data.expiresAt) {
      phantomTokens.delete(token);
    }
  }
  // Cleanup refresh tokens
  for (const [token, data] of refreshTokens.entries()) {
    if (now > data.expiresAt) {
      refreshTokens.delete(token);
    }
  }
}, 5 * 60 * 1000);
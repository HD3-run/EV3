"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePhantomToken = exports.createPhantomTokenPair = exports.validateJWT = exports.revokeRefreshToken = exports.validateRefreshToken = exports.createRefreshToken = exports.createJWT = exports.generatePhantomToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const logger_js_1 = require("./logger.js");
// Refresh token storage
const refreshTokens = new Map();
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'ecommitra-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ecommitra-client';
// Phantom token storage (in production, use Redis)
const phantomTokens = new Map();
// Generate opaque phantom token
const generatePhantomToken = () => {
    return crypto_1.default.randomBytes(32).toString('hex');
};
exports.generatePhantomToken = generatePhantomToken;
// Create JWT with shorter lifetime
const createJWT = (payload) => {
    const sanitizedPayload = {
        sub: payload.userId,
        role: payload.role,
        merchant_id: payload.merchant_id,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 minutes
        iat: Math.floor(Date.now() / 1000)
    };
    return jsonwebtoken_1.default.sign(sanitizedPayload, JWT_SECRET, { algorithm: 'HS256' });
};
exports.createJWT = createJWT;
// Create refresh token
const createRefreshToken = (userId) => {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    refreshTokens.set(token, { userId, expiresAt });
    return token;
};
exports.createRefreshToken = createRefreshToken;
// Validate refresh token
const validateRefreshToken = (token) => {
    const data = refreshTokens.get(token);
    if (!data || Date.now() > data.expiresAt) {
        refreshTokens.delete(token);
        return null;
    }
    return data.userId;
};
exports.validateRefreshToken = validateRefreshToken;
// Revoke refresh token
const revokeRefreshToken = (token) => {
    refreshTokens.delete(token);
};
exports.revokeRefreshToken = revokeRefreshToken;
// Validate JWT with issuer/audience checks
const validateJWT = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            algorithms: ['HS256'] // Don't trust algo header
        });
        return decoded;
    }
    catch (error) {
        logger_js_1.logger.warn('JWT validation failed', { error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};
exports.validateJWT = validateJWT;
// Phantom token pattern implementation
const createPhantomTokenPair = (userPayload) => {
    const phantomToken = (0, exports.generatePhantomToken)();
    const jwt = (0, exports.createJWT)(userPayload);
    // Store JWT reference with phantom token
    phantomTokens.set(phantomToken, {
        jwt,
        userPayload,
        createdAt: Date.now(),
        expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes
    });
    return { phantomToken, jwt };
};
exports.createPhantomTokenPair = createPhantomTokenPair;
// Resolve phantom token to JWT
const resolvePhantomToken = (phantomToken) => {
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
exports.resolvePhantomToken = resolvePhantomToken;
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
//# sourceMappingURL=jwt.js.map
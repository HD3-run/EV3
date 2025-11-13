"use strict";
/**
 * Authentication and authorization middleware
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminOrManager = exports.requireAdmin = void 0;
exports.authenticateUser = authenticateUser;
exports.requireRole = requireRole;
exports.requireSession = requireSession;
const db_1 = require("../db");
const logger_1 = require("../utils/logger");
const constants_1 = require("../utils/constants");
const cache_1 = require("./cache");
/**
 * Middleware to authenticate user and attach user data to request
 * Supports both phantom token (Authorization header) and session-based auth
 */
async function authenticateUser(req, res, next) {
    try {
        let userId;
        let authMethod = 'none';
        // Try phantom token authentication first
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const phantomToken = authHeader.substring(7);
            try {
                const { resolvePhantomToken, validateJWT } = await Promise.resolve().then(() => __importStar(require('../utils/jwt')));
                const tokenData = resolvePhantomToken(phantomToken);
                if (tokenData) {
                    const decoded = validateJWT(tokenData.jwt);
                    if (decoded && decoded.sub) {
                        userId = decoded.sub;
                        authMethod = 'phantom_token';
                    }
                }
            }
            catch (error) {
                logger_1.logger.warn('Phantom token validation failed', { error: error instanceof Error ? error.message : String(error) });
            }
        }
        // Fallback to session-based auth
        if (!userId) {
            userId = req.session?.userId;
            if (userId) {
                authMethod = 'session';
            }
        }
        // Enhanced debugging for development
        if (process.env.NODE_ENV === 'development') {
            logger_1.logger.info('Authentication Debug', {
                path: req.path,
                method: req.method,
                authMethod,
                userId,
                hasAuthHeader: !!authHeader,
                hasSession: !!req.session,
                sessionId: req.sessionID
            });
        }
        if (!userId) {
            logger_1.logger.error('Authentication failed - no valid credentials', {
                authMethod,
                hasAuthHeader: !!authHeader,
                sessionExists: !!req.session,
                path: req.path,
                method: req.method
            });
            return res.status(401).json({
                message: 'Authentication required',
                debug: process.env.NODE_ENV === 'development' ? {
                    authMethod,
                    hasAuthHeader: !!authHeader,
                    sessionExists: !!req.session,
                    path: req.path
                } : undefined
            });
        }
        // Try cache first
        const cacheKey = `user_${userId}`;
        let userData = cache_1.cache.get(cacheKey);
        if (!userData) {
            const client = await db_1.pool.connect();
            try {
                const userResult = await client.query('SELECT user_id, merchant_id, username, email, role FROM oms.users WHERE user_id = $1', [userId]);
                if (userResult.rows.length === 0) {
                    logger_1.logger.error('User not found in database', {
                        userId: userId,
                        userIdType: typeof userId,
                        path: req.path
                    });
                    return res.status(401).json({
                        message: constants_1.MESSAGES.USER_NOT_FOUND,
                        debug: process.env.NODE_ENV === 'development' ? {
                            userId: userId,
                            userIdType: typeof userId
                        } : undefined
                    });
                }
                userData = userResult.rows[0];
                // Cache for 5 minutes
                cache_1.cache.set(cacheKey, userData, 300);
                if (process.env.NODE_ENV === 'development') {
                    logger_1.logger.info('User data loaded from database', {
                        userId: userData.user_id,
                        role: userData.role,
                        merchantId: userData.merchant_id,
                        username: userData.username
                    });
                }
            }
            finally {
                client.release();
            }
        }
        else if (process.env.NODE_ENV === 'development') {
            logger_1.logger.info('User data loaded from cache', {
                userId: userData.user_id,
                role: userData.role,
                merchantId: userData.merchant_id,
                username: userData.username
            });
        }
        req.user = userData;
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            path: req.path,
            userId: req.session?.userId,
            sessionId: req.sessionID
        });
        res.status(500).json({
            message: constants_1.MESSAGES.INTERNAL_ERROR,
            debug: process.env.NODE_ENV === 'development' ? {
                error: error instanceof Error ? error.message : String(error)
            } : undefined
        });
    }
}
/**
 * Middleware to check if user has required role
 */
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: constants_1.MESSAGES.UNAUTHORIZED });
        }
        next();
    };
}
/**
 * Middleware to check if user is admin
 */
exports.requireAdmin = requireRole(constants_1.USER_ROLES.ADMIN);
/**
 * Middleware to check if user is admin or manager
 */
exports.requireAdminOrManager = requireRole([constants_1.USER_ROLES.ADMIN, constants_1.USER_ROLES.MANAGER]);
/**
 * Middleware to validate session exists
 */
function requireSession(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: 'Session required' });
    }
    next();
}
//# sourceMappingURL=auth.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSecurityEvents = exports.preventUrlManipulation = exports.validateQuantity = exports.validatePagination = exports.clearFailedAttempts = exports.trackFailedLogin = exports.checkAccountLockout = exports.validatePassword = exports.sanitizeForLog = exports.sanitizeForSQL = exports.sanitizeInput = void 0;
const logger_1 = require("../utils/logger");
// Account lockout tracking
const failedAttempts = new Map();
// Enhanced input sanitization with XSS protection
const sanitizeInput = (req, _res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj
                .replace(/[<>"'&]/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
                .trim();
        }
        if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
            const sanitized = {};
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
    if (req.body)
        req.body = sanitize(req.body);
    if (req.query)
        req.query = sanitize(req.query);
    next();
};
exports.sanitizeInput = sanitizeInput;
// SQL injection protection
const sanitizeForSQL = (input) => {
    if (typeof input !== 'string')
        return input;
    return input.replace(/[';"\\]/g, '');
};
exports.sanitizeForSQL = sanitizeForSQL;
// Log sanitization to prevent log injection
const sanitizeForLog = (input) => {
    if (typeof input === 'object') {
        input = JSON.stringify(input);
    }
    return String(input).replace(/[\r\n\t]/g, '_');
};
exports.sanitizeForLog = sanitizeForLog;
// Password complexity validation
const validatePassword = (req, res, next) => {
    const { password } = req.body;
    if (!password)
        return next();
    const errors = [];
    if (password.length < 8)
        errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password))
        errors.push('Password must contain uppercase letter');
    if (!/[a-z]/.test(password))
        errors.push('Password must contain lowercase letter');
    if (!/\d/.test(password))
        errors.push('Password must contain number');
    if (!/[!@#$%^&*]/.test(password))
        errors.push('Password must contain special character');
    if (errors.length > 0) {
        return res.status(400).json({ message: 'Password requirements not met', errors });
    }
    next();
};
exports.validatePassword = validatePassword;
// Account lockout middleware
const checkAccountLockout = (req, res, next) => {
    const id = req.body.email || req.body.username || req.ip;
    const attempts = failedAttempts.get(id);
    if (attempts?.lockUntil && Date.now() < attempts.lockUntil) {
        const mins = Math.ceil((attempts.lockUntil - Date.now()) / 60000);
        return res.status(423).json({ message: `Account locked. Try again in ${mins} minutes.` });
    }
    next();
};
exports.checkAccountLockout = checkAccountLockout;
// Track failed attempts
const trackFailedLogin = (identifier) => {
    const attempts = failedAttempts.get(identifier) || { count: 0 };
    attempts.count += 1;
    if (attempts.count >= 5) {
        attempts.lockUntil = Date.now() + (15 * 60 * 1000);
        logger_1.logger.warn('Account locked', { identifier, attempts: attempts.count });
    }
    failedAttempts.set(identifier, attempts);
};
exports.trackFailedLogin = trackFailedLogin;
// Clear failed attempts
const clearFailedAttempts = (identifier) => {
    failedAttempts.delete(identifier);
};
exports.clearFailedAttempts = clearFailedAttempts;
// Pagination validation
const validatePagination = (req, _res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    if (page < 1)
        req.query.page = '1';
    if (limit < 1)
        req.query.limit = '20';
    next();
};
exports.validatePagination = validatePagination;
// Quantity validation
const validateQuantity = (req, res, next) => {
    if (req.body.quantity !== undefined) {
        const quantity = parseInt(req.body.quantity);
        if (isNaN(quantity) || quantity < 0) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }
        req.body.quantity = quantity;
    }
    next();
};
exports.validateQuantity = validateQuantity;
// Enhanced URL manipulation protection
const preventUrlManipulation = (req, res, next) => {
    const url = req.url;
    const suspicious = ['%2e', '..', '%2f', '%5c', '\\', '%00', 'etc/passwd', 'cmd.exe'];
    if (suspicious.some(pattern => url.toLowerCase().includes(pattern))) {
        logger_1.logger.warn('Suspicious URL detected', { url, ip: req.ip });
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};
exports.preventUrlManipulation = preventUrlManipulation;
// Security event logging
const logSecurityEvents = (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        if (res.statusCode >= 400) {
            logger_1.logger.warn('Security event', {
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
exports.logSecurityEvents = logSecurityEvents;
// Cleanup expired lockouts
setInterval(() => {
    const now = Date.now();
    for (const [key, attempts] of failedAttempts.entries()) {
        if (attempts.lockUntil && now > attempts.lockUntil) {
            failedAttempts.delete(key);
        }
    }
}, 5 * 60 * 1000);
//# sourceMappingURL=validation.js.map
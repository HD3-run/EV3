"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshSession = exports.validateSession = void 0;
const logger_js_1 = require("../utils/logger.js");
// Session validation middleware
const validateSession = (req, res, next) => {
    // Skip validation for auth endpoints
    if (req.path.includes('/auth/') || req.path === '/api/auth/login' || req.path === '/api/auth/register') {
        return next();
    }
    const session = req.session;
    // Only validate if session exists and has user data
    if (session && session.user && session.userId) {
        // Check session expiry if set
        if (session.expires && new Date() > new Date(session.expires)) {
            session.destroy((err) => {
                if (err)
                    logger_js_1.logger.error('Session destruction error', err);
            });
            return res.status(401).json({ message: 'Session expired' });
        }
    }
    next();
};
exports.validateSession = validateSession;
// Short-lived token refresh
const refreshSession = (req, _res, next) => {
    // Skip refresh for auth endpoints
    if (req.path.includes('/auth/') || req.path === '/api/auth/login' || req.path === '/api/auth/register') {
        return next();
    }
    const session = req.session;
    if (session && session.userId) {
        // Refresh session expiry (30 minutes from now)
        session.expires = new Date(Date.now() + 30 * 60 * 1000);
    }
    next();
};
exports.refreshSession = refreshSession;
//# sourceMappingURL=session-security.js.map
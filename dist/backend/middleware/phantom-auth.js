"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phantomAuth = void 0;
const jwt_js_1 = require("../utils/jwt.js");
// Phantom token authentication middleware
const phantomAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const phantomToken = authHeader.substring(7);
    // Resolve phantom token to JWT
    const tokenData = (0, jwt_js_1.resolvePhantomToken)(phantomToken);
    if (!tokenData) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
    // Validate the actual JWT
    const decoded = (0, jwt_js_1.validateJWT)(tokenData.jwt);
    if (!decoded) {
        return res.status(401).json({ message: 'Invalid JWT' });
    }
    // Attach user data to request
    req.user = {
        userId: decoded.sub,
        role: decoded.role,
        merchant_id: decoded.merchant_id
    };
    next();
};
exports.phantomAuth = phantomAuth;
//# sourceMappingURL=phantom-auth.js.map
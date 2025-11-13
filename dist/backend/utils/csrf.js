"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCSRFToken = generateCSRFToken;
exports.verifyCSRFToken = verifyCSRFToken;
exports.csrfProtection = csrfProtection;
const crypto_1 = __importDefault(require("crypto"));
const CSRF_SECRET = process.env.CSRF_SECRET || 'your-csrf-secret-change-in-production';
function generateCSRFToken(req) {
    if (!req.session['csrfSecret']) {
        req.session['csrfSecret'] = crypto_1.default.randomBytes(32).toString('hex');
    }
    const token = crypto_1.default.createHmac('sha256', CSRF_SECRET)
        .update(req.session['csrfSecret'])
        .digest('hex');
    return token;
}
function verifyCSRFToken(req, token) {
    if (!req.session['csrfSecret'] || !token) {
        return false;
    }
    const expectedToken = crypto_1.default.createHmac('sha256', CSRF_SECRET)
        .update(req.session['csrfSecret'])
        .digest('hex');
    // Use crypto.timingSafeEqual for secure comparison
    const expectedBuffer = Buffer.from(expectedToken, 'utf8');
    const tokenBuffer = Buffer.from(token, 'utf8');
    if (expectedBuffer.length !== tokenBuffer.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(expectedBuffer, tokenBuffer);
}
function csrfProtection(req, res, next) {
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
//# sourceMappingURL=csrf.js.map
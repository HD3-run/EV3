"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const compression_1 = __importDefault(require("compression"));
const multer_1 = __importDefault(require("multer"));
const express_session_1 = __importDefault(require("express-session"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const helmet_1 = __importDefault(require("helmet"));
// Load environment variables from envfiles directory
// Use process.cwd() since PM2 runs from project root
const envFile = process.env.NODE_ENV === 'production' ? 'prod.env' : 'dev.env';
const envPath = path_1.default.join(process.cwd(), 'envfiles', envFile);
if (fs_1.default.existsSync(envPath)) {
    dotenv_1.default.config({ path: envPath });
    console.log(`Loaded environment from ${envFile}`);
}
else {
    // Fallback to default .env loading
    dotenv_1.default.config();
    console.warn(`Environment file ${envFile} not found, using .env or system environment`);
}
const logger_1 = require("./utils/logger");
const validation_1 = require("./middleware/validation");
const csrf_protection_1 = require("./middleware/csrf-protection");
const rate_limit_1 = require("./middleware/rate-limit");
const response_optimizer_1 = require("./utils/response-optimizer");
// Basic HTTP configuration
const PORT = parseInt(process.env.PORT || '5000');
const isProd = process.env.NODE_ENV === 'production';
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: isProd ?
            (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*']) :
            [
                'http://localhost:3000',
                'http://localhost:5173',
                'http://localhost:5001',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:5000',
                'http://13.234.118.33:5173',
                'http://13.234.118.33:5000'
            ],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Enable both WebSocket and polling transports
    allowEIO3: true // Allow Engine.IO v3 clients
});
// Make io available globally
global.io = io;
io.on('connection', (socket) => {
    logger_1.logger.info('New WebSocket client connected', {
        id: socket.id,
        transport: socket.conn.transport.name,
        userAgent: socket.conn.request.headers['user-agent']
    });
    // Handle connection events
    socket.on('disconnect', (reason) => {
        logger_1.logger.info('WebSocket client disconnected', {
            id: socket.id,
            reason: reason
        });
        console.log('❌ WebSocket client disconnected:', {
            id: socket.id,
            reason: reason,
            remainingClients: io.sockets.sockets.size
        });
    });
    socket.on('error', (error) => {
        logger_1.logger.error('WebSocket error', {
            id: socket.id,
            error: error.message
        });
    });
    // Send welcome message to confirm connection
    socket.emit('welcome', {
        message: 'Connected to WebSocket server',
        timestamp: new Date().toISOString(),
        serverPort: PORT
    });
    // Log connection details for debugging
    console.log('🔗 WebSocket client connected:', {
        id: socket.id,
        transport: socket.conn.transport.name,
        connectedClients: io.sockets.sockets.size
    });
    // Handle connection test from frontend
    socket.on('connection-test', (data) => {
        console.log('🧪 Connection test received from client:', {
            clientId: data.clientId,
            timestamp: data.timestamp,
            socketId: socket.id
        });
        // Send response back to confirm connection is working
        socket.emit('connection-test-response', {
            success: true,
            serverTimestamp: new Date().toISOString(),
            clientId: data.clientId,
            socketId: socket.id
        });
    });
});
logger_1.logger.info(`Starting server in ${isProd ? 'production' : 'development'} mode...`);
// Add a test endpoint to verify WebSocket server is running
app.get('/api/websocket-status', (_req, res) => {
    const connectedClients = io.sockets.sockets.size;
    res.json({
        status: 'WebSocket server is running',
        connectedClients,
        port: PORT,
        timestamp: new Date().toISOString()
    });
});
// Add request logging middleware early
app.use((req, _res, next) => {
    logger_1.logger.info(`${req.method} ${req.path}`);
    next();
});
// Disable ETag/conditional GET to avoid 304 caching on API responses
app.set('etag', false);
// Force no-store caching policy for all API endpoints
app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
// Enhanced CORS configuration
const corsOptions = {
    origin: isProd ?
        (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []) :
        [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5000',
            'http://13.234.118.33:5173',
            'http://13.234.118.33:5000'
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'x-csrf-token',
        'Cache-Control',
        'Pragma'
    ],
    exposedHeaders: ['set-cookie']
};
// Apply CORS with the above configuration
app.use((0, cors_1.default)(corsOptions));
// Handle preflight requests
app.options('*', (0, cors_1.default)(corsOptions));
// Add cookie parser
app.use((0, cookie_parser_1.default)());
// Validate session secret in production
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'your-session-secret-change-in-production')) {
    logger_1.logger.error('SESSION_SECRET must be set to a secure value in production');
    process.exit(1);
}
// Simple session configuration
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: true,
    saveUninitialized: false,
    name: 'connect.sid',
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));
// Enable gzip compression
app.use((0, compression_1.default)({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
    level: 6,
    threshold: 1024
}));
// Security middleware (before rate limiting)
app.use(validation_1.logSecurityEvents);
app.use(validation_1.preventUrlManipulation);
app.use(validation_1.sanitizeInput);
// CSRF protection disabled - session-based auth is already secure
// app.use('/api/auth', csrfProtection);
// CSRF token endpoint (kept for future use)
app.get('/api/csrf-token', csrf_protection_1.getCSRFToken);
// Rate limiting - Apply to specific methods and paths
app.use('/api/', rate_limit_1.apiLimiter);
app.use('/api/auth/', rate_limit_1.authLimiter);
app.use('/api/*/upload*', rate_limit_1.uploadLimiter);
// Apply orderLimiter only to write operations (POST, PUT, PATCH, DELETE)
app.use('/api/orders', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return (0, rate_limit_1.orderLimiter)(req, res, next);
    }
    next();
});
// Response optimization
app.use(response_optimizer_1.selectFields);
app.use(response_optimizer_1.compressResponse);
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({
    extended: true,
    limit: '10mb'
}));
// Configure multer for file uploads with security limits
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '8388608'), // 8MB default
        files: 1,
        fieldSize: 1024 * 1024, // 1MB field size limit
    },
    fileFilter: (_req, file, cb) => {
        // Allow only specific file types
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.csv', '.xls', '.xlsx'];
        const fileExt = require('path').extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExt)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type or extension'));
        }
    }
});
exports.upload = upload;
// Helmet.js security headers with CSP
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            objectSrc: ["'none'"]
        }
    },
    hsts: false // Disabled - we're using HTTP, not HTTPS
}));
// Request size validation
app.use((req, res, next) => {
    const size = parseInt(req.get('content-length') || '0');
    if (size > 10 * 1024 * 1024) {
        return res.status(413).json({ message: 'Request too large' });
    }
    next();
});
// HTTPS enforcement disabled - we're using HTTP, not HTTPS
// If you add SSL/TLS later, uncomment this:
// if (isProd) {
//   app.use((req, res, next) => {
//     if (req.header('x-forwarded-proto') !== 'https') {
//       return res.redirect(301, `https://${req.header('host')}${req.url}`);
//     }
//     next();
//   });
// }
// Basic auth endpoints
// Removed basic in-memory login route to ensure the real database-backed authentication in routes.ts is used.
// Session validation and login endpoints are handled in routes.ts
// Mock endpoints - only available in development
if (process.env.NODE_ENV === 'development') {
    app.get('/api/picks', (_req, res) => {
        const mockPicks = [
            {
                id: 'PK-2024-001',
                items: 12,
                location: 'Warehouse A',
                status: 'completed',
                time: '2024-01-01T10:00:00Z'
            },
            {
                id: 'PK-2024-002',
                items: 8,
                location: 'Warehouse B',
                status: 'in-progress',
                time: '2024-01-01T11:30:00Z'
            }
        ];
        res.json(mockPicks);
    });
    // Mock activities endpoint
    app.get('/api/activities/recent', (_req, res) => {
        const mockActivities = [
            {
                action: 'Pick list PK-2024-001 completed',
                time: '2 minutes ago',
                color: 'text-green-400'
            },
            {
                action: 'New order received from Flipkart',
                time: '5 minutes ago',
                color: 'text-blue-400'
            }
        ];
        res.json(mockActivities);
    });
}
// Try to register full routes if available
async function setupRoutes() {
    try {
        logger_1.logger.info('Attempting to load full routes...');
        const { registerRoutes } = await Promise.resolve().then(() => __importStar(require('./routes')));
        registerRoutes(app);
        // Add catch-all route for SPA after API routes
        if (isProd) {
            const path = require('path');
            app.get('*', (req, res) => {
                res.sendFile(path.join(__dirname, '../frontend/index.html'));
            });
        }
        logger_1.logger.info('Full routes loaded successfully');
        return app;
    }
    catch (error) {
        logger_1.logger.warn('Could not load full routes, using basic routes', error instanceof Error ? error.message : String(error));
        return null;
    }
}
// Error handling middleware
app.use((err, _req, res, _next) => {
    logger_1.logger.error('Server error', err instanceof Error ? err.message : String(err));
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// Serve static frontend files in production
if (isProd) {
    const path = require('path');
    app.use(express_1.default.static(path.join(__dirname, '../frontend')));
}
// Start the server
async function startServer() {
    try {
        // Try to setup full routes first
        const httpServer = await setupRoutes();
        if (httpServer) {
            server.listen(PORT, '0.0.0.0', () => {
                logger_1.logger.info(`Server running on 0.0.0.0:${PORT}`);
            });
        }
        else {
            return null;
        }
    }
    catch (error) {
        logger_1.logger.warn('Could not load full routes, using basic routes', error instanceof Error ? error.message : String(error));
        return null;
    }
}
// Process-level error handlers to prevent crashes
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception - Server will continue running', {
        error: error.message,
        stack: error.stack,
        name: error.name
    });
    // Don't exit - let the server continue running
    // The connection pool will handle dead connections
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection - Server will continue running', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined
    });
    // Don't exit - let the server continue running
});
// Handle database connection errors gracefully
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger_1.logger.info('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger_1.logger.info('Server closed');
        process.exit(0);
    });
});
startServer().catch(error => {
    logger_1.logger.error('Failed to start server', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
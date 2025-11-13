import compression from "compression";
import multer from 'multer';
import session from "express-session";
import cookieParser from "cookie-parser";
import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';

import { logger } from './utils/logger';
import { sanitizeInput, preventUrlManipulation, logSecurityEvents } from './middleware/validation';
import { csrfProtection, getCSRFToken } from './middleware/csrf-protection';
import { apiLimiter, authLimiter, uploadLimiter, orderLimiter } from './middleware/rate-limit';
import { selectFields, compressResponse } from './utils/response-optimizer';



declare global {
  namespace Express {
    interface Request {
      session: import("express-session").Session & Partial<import("express-session").SessionData>;
    }
    interface Application {
      io: SocketIOServer;
    }
  }
}

// Basic HTTP configuration
const PORT = parseInt(process.env.PORT || '5000');
const isProd = process.env.NODE_ENV === 'production';
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: isProd ? 
      (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*']) :
      [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5000'
      ],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Enable both WebSocket and polling transports
  allowEIO3: true // Allow Engine.IO v3 clients
});

// Make io available globally
(global as any).io = io;

io.on('connection', (socket) => {
  logger.info('New WebSocket client connected', {
    id: socket.id,
    transport: socket.conn.transport.name,
    userAgent: socket.conn.request.headers['user-agent']
  });

  // Handle connection events
  socket.on('disconnect', (reason) => {
    logger.info('WebSocket client disconnected', {
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
    logger.error('WebSocket error', {
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

logger.info(`Starting server in ${isProd ? 'production' : 'development'} mode...`);

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
  logger.info(`${req.method} ${req.path}`);
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
      'http://127.0.0.1:5000'
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
    'Cache-Control'
  ],
  exposedHeaders: ['set-cookie']
};

// Apply CORS with the above configuration
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add cookie parser
app.use(cookieParser());



// Validate session secret in production
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'your-session-secret-change-in-production')) {
  logger.error('SESSION_SECRET must be set to a secure value in production');
  process.exit(1);
}

// Simple session configuration
app.use(session({
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
app.use(compression({
  filter: (req: any, res: any) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

// Security middleware (before rate limiting)
app.use(logSecurityEvents);
app.use(preventUrlManipulation);
app.use(sanitizeInput);

// CSRF protection disabled - session-based auth is already secure
// app.use('/api/auth', csrfProtection);

// CSRF token endpoint (kept for future use)
app.get('/api/csrf-token', getCSRFToken);

// Rate limiting - Apply to specific methods and paths
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/*/upload*', uploadLimiter);

// Apply orderLimiter only to write operations (POST, PUT, PATCH, DELETE)
app.use('/api/orders', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return orderLimiter(req, res, next);
  }
  next();
});

// Response optimization
app.use(selectFields);
app.use(compressResponse);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Configure multer for file uploads with security limits
const upload = multer({
  storage: multer.memoryStorage(),
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
    } else {
      cb(new Error('Invalid file type or extension'));
    }
  }
});

// Export upload middleware for use in routes
export { upload };



// Helmet.js security headers with CSP
app.use(helmet({
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
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false
}));

// Request size validation
app.use((req, res, next) => {
  const size = parseInt(req.get('content-length') || '0');
  if (size > 10 * 1024 * 1024) {
    return res.status(413).json({ message: 'Request too large' });
  }
  next();
});

// HTTPS enforcement in production
if (isProd) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });
}





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
    logger.info('Attempting to load full routes...');
    const { registerRoutes } = await import('./routes');
    registerRoutes(app);
    
    // Add catch-all route for SPA after API routes
    if (isProd) {
      const path = require('path');
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
      });
    }
    
    logger.info('Full routes loaded successfully');
    return app;
  } catch (error) {
    logger.warn('Could not load full routes, using basic routes', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Server error', err instanceof Error ? err.message : String(err));
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve static frontend files in production
if (isProd) {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend')));
}

// Start the server
async function startServer() {
  try {
    // Try to setup full routes first
    const httpServer = await setupRoutes();
    
    if (httpServer) {
      server.listen(PORT, '0.0.0.0', () => {
        logger.info(`Server running on 0.0.0.0:${PORT}`);
      });
    } else {
      return null;
    }
  } catch (error) {
    logger.warn('Could not load full routes, using basic routes', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Process-level error handlers to prevent crashes
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception - Server will continue running', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
  // Don't exit - let the server continue running
  // The connection pool will handle dead connections
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection - Server will continue running', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  // Don't exit - let the server continue running
});

// Handle database connection errors gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer().catch(error => {
  logger.error('Failed to start server', error);
  process.exit(1);
});

import { rateLimit } from 'express-rate-limit';

// General API rate limiting - More generous for development
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window (increased from 100)
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiting - Balanced for development and security
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min (allows session validation on page refresh)
  message: { message: 'Too many authentication requests, please try again later' },
  skipSuccessfulRequests: false, // Count all requests to prevent abuse
  standardHeaders: true,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many authentication requests',
      retryAfter: Math.round(15 * 60)
    });
  }
});

// File upload rate limiting
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute (increased from 3)
  message: { message: 'Too many file uploads, please wait' },
});

// Create order rate limiting - More generous
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 orders per minute (increased from 10)
  message: { message: 'Too many orders created, please slow down' },
});

// Global rate limiting for public orders - shared across ALL users/IPs
// This prevents 100 people ordering simultaneously from overwhelming the system
export const publicOrderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 orders per minute globally (across all users)
  message: { message: 'System is currently processing many orders. Please try again in a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Use a shared store or skip successful requests to count all attempts
  skipSuccessfulRequests: false, // Count all requests to track total load
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'System is currently processing many orders. Please try again in a moment.',
      retryAfter: 60 // Retry after 60 seconds
    });
  }
});
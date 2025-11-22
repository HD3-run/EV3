"use strict";
/**
 * Simple in-memory caching middleware for performance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = void 0;
exports.cacheMiddleware = cacheMiddleware;
exports.invalidateUserCache = invalidateUserCache;
class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 1000;
    }
    set(key, data, ttlSeconds = 300) {
        // Clean old entries if cache is full
        if (this.cache.size >= this.maxSize) {
            this.cleanup();
        }
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlSeconds * 1000
        });
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    delete(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }
}
const cache = new SimpleCache();
exports.cache = cache;
function cacheMiddleware(ttlSeconds = 300) {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }
        // Create cache key from URL and user session
        // Include query parameters in cache key to differentiate filters
        const cacheKey = `${req.originalUrl}_${req.session?.userId}`;
        console.log('🔍 Cache middleware - checking key:', cacheKey);
        console.log('👤 Session userId:', req.session?.userId);
        console.log('🌐 Original URL:', req.originalUrl);
        // Don't cache if query has cache-busting parameter or if filtering by "assigned"
        // The assigned filter needs fresh data since assignments don't change status
        if (req.query._t || req.query.status === 'assigned') {
            console.log('🚫 Cache-busting parameter or assigned filter detected, skipping cache');
            return next();
        }
        // Try to get from cache
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            console.log('🎯 Cache HIT - returning cached data for key:', cacheKey);
            return res.json(cachedData);
        }
        console.log('❌ Cache MISS - fetching fresh data for key:', cacheKey);
        // Override res.json to cache the response
        const originalJson = res.json;
        res.json = function (data) {
            // Cache successful responses
            if (res.statusCode === 200) {
                console.log('💾 Caching response for key:', cacheKey);
                cache.set(cacheKey, data, ttlSeconds);
            }
            return originalJson.call(this, data);
        };
        next();
    };
}
function invalidateUserCache(userId) {
    const userIdStr = String(userId);
    console.log('🔄 Starting cache invalidation for user:', userIdStr);
    console.log('📊 Current cache keys:', Array.from(cache['cache'].keys()));
    let invalidatedCount = 0;
    // Invalidate all cache entries for this user (including all filter variations)
    for (const key of cache['cache'].keys()) {
        if (key.endsWith(`_${userIdStr}`) || key.includes(`_${userIdStr}`)) {
            console.log('🗑️ Invalidating user cache key:', key);
            cache.delete(key);
            invalidatedCount++;
        }
    }
    console.log(`✅ User cache invalidation completed for user: ${userIdStr} (${invalidatedCount} keys invalidated)`);
    console.log('📊 Remaining cache keys:', Array.from(cache['cache'].keys()));
}
//# sourceMappingURL=cache.js.map
/**
 * Simple in-memory caching middleware for performance
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 1000;

  set(key: string, data: any, ttlSeconds: number = 300): void {
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

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new SimpleCache();

export function cacheMiddleware(ttlSeconds: number = 300) {
  return (req: any, res: any, next: any) => {
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
    res.json = function(data: any) {
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

export function invalidateUserCache(userId: string | number): void {
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

export { cache };
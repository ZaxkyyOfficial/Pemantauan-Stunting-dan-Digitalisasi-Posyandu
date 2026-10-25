const Redis = require('ioredis');
const NodeCache = require('node-cache');

const fallbackCache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,
});

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let isRedisConnected = false;

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 1000, 3000);
  },
});

redis.on('connect', () => {
  isRedisConnected = true;
});

redis.on('ready', () => {
  isRedisConnected = true;
});

redis.on('error', () => {
  isRedisConnected = false;
});

redis.on('close', () => {
  isRedisConnected = false;
});

redis.connect().catch(() => {
  isRedisConnected = false;
});

function cacheMiddleware(ttlSeconds = 60) {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = req.originalUrl || req.url;

    if (isRedisConnected) {
      try {
        const cachedRaw = await redis.get(cacheKey);
        if (cachedRaw) {
          res.setHeader('X-Cache', 'HIT (Redis)');
          res.setHeader('X-Cache-TTL', ttlSeconds);
          
          const parsed = JSON.parse(cachedRaw);
          if (parsed && parsed.__isHtml) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(parsed.content);
          }
          return res.status(200).json(parsed);
        }
      } catch (err) {
        // Fallback to node-cache on Redis error
      }
    }

    const memCached = fallbackCache.get(cacheKey);
    if (memCached) {
      res.setHeader('X-Cache', 'HIT (Node-Cache)');
      res.setHeader('X-Cache-TTL', ttlSeconds);

      if (memCached && memCached.__isHtml) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(memCached.content);
      }
      return res.status(200).json(memCached);
    }

    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        saveToCache(cacheKey, body, ttlSeconds);
      }
      return originalJson(body);
    };

    const originalSend = res.send.bind(res);
    res.send = (body) => {
      const contentType = res.getHeader('Content-Type') || '';
      if (
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        typeof body === 'string' &&
        String(contentType).includes('text/html')
      ) {
        saveToCache(cacheKey, { __isHtml: true, content: body }, ttlSeconds);
      }
      return originalSend(body);
    };

    next();
  };
}

async function saveToCache(key, data, ttlSeconds) {
  if (isRedisConnected) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
      return;
    } catch (err) {
      // Fallback to memory cache
    }
  }
  fallbackCache.set(key, data, ttlSeconds);
}

async function clearCache(keyPattern) {
  if (isRedisConnected) {
    try {
      const keys = await redis.keys(keyPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (e) {}
  }
  fallbackCache.del(keyPattern);
}

module.exports = {
  cacheMiddleware,
  clearCache,
  redisClient: redis,
  fallbackCache,
};

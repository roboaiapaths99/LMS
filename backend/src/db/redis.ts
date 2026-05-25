import Redis from 'ioredis';
import { env } from '../config/env';

let redis: Redis;
let redisErrorLogged = false;

try {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy(times) {
      // Stop retrying after 3 attempts in dev mode to prevent log spam
      if (times > 3) {
        if (!redisErrorLogged) {
          console.warn('⚠️ Redis unavailable — running without cache. OTP/session features will use in-memory fallback.');
          redisErrorLogged = true;
        }
        return null; // Stop reconnecting
      }
      return Math.min(times * 500, 2000);
    },
    lazyConnect: false,
  });
  
  redis.on('connect', () => {
    console.log('📡 Redis Connected successfully');
    redisErrorLogged = false;
  });

  redis.on('error', (err) => {
    if (!redisErrorLogged) {
      console.error('❌ Redis connection error:', err.message);
      redisErrorLogged = true;
    }
  });
} catch (error) {
  console.error('❌ Redis initialization error:', error);
}

export { redis };

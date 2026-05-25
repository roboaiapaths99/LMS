"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
let redis;
let redisErrorLogged = false;
try {
    exports.redis = redis = new ioredis_1.default(env_1.env.REDIS_URL, {
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
}
catch (error) {
    console.error('❌ Redis initialization error:', error);
}

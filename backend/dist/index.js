"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const formbody_1 = __importDefault(require("@fastify/formbody"));
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./config/env");
const mongodb_1 = require("./db/mongodb");
const redis_1 = require("./db/redis");
const auth_1 = __importDefault(require("./routes/auth"));
const devices_1 = __importDefault(require("./routes/devices"));
const courses_1 = __importDefault(require("./routes/courses"));
const bundles_1 = __importDefault(require("./routes/bundles"));
const orders_1 = __importDefault(require("./routes/orders"));
const admin_1 = __importDefault(require("./routes/admin"));
const sessions_1 = __importDefault(require("./routes/sessions"));
const ai_1 = __importDefault(require("./routes/ai"));
const fastify = (0, fastify_1.default)({
    logger: {
        level: env_1.env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
});
async function bootstrap() {
    try {
        // 1. Connect to Database (MongoDB)
        await (0, mongodb_1.connectDB)();
        // 2. Register Plugins
        await fastify.register(cors_1.default, {
            origin: env_1.env.NODE_ENV === 'development' ? true : ['https://roboaiapaths.com', 'https://lms.roboaiapaths.com'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        });
        await fastify.register(cookie_1.default, {
            secret: env_1.env.JWT_REFRESH_SECRET,
            parseOptions: {},
        });
        // Form body parser (PayU webhook sends application/x-www-form-urlencoded)
        await fastify.register(formbody_1.default);
        // Rate Limiting — use Redis if connected, otherwise in-memory
        const rateLimitOpts = {
            max: 100,
            timeWindow: '1 minute',
            keyGenerator: (req) => req.ip,
            errorResponseBuilder: (_req, context) => ({
                statusCode: 429,
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Try again in ${context.after}.`,
            }),
        };
        if (redis_1.redis && redis_1.redis.status === 'ready') {
            rateLimitOpts.redis = redis_1.redis;
        }
        await fastify.register(rate_limit_1.default, rateLimitOpts);
        await fastify.register(websocket_1.default);
        await fastify.register(multipart_1.default, {
            limits: {
                fileSize: 1024 * 1024 * 500, // 500MB
            }
        });
        // 3. Global Error Handler
        fastify.setErrorHandler((error, request, reply) => {
            fastify.log.error(error);
            if (error.statusCode === 429) {
                return reply.status(429).send(error);
            }
            if (error.name === 'ValidationError') {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: error.message });
            }
            reply.status(error.statusCode || 500).send({
                statusCode: error.statusCode || 500,
                error: error.name || 'Internal Server Error',
                message: env_1.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.',
            });
        });
        // 4. Register All Routes
        fastify.register(auth_1.default, { prefix: '/api/v1/auth' });
        fastify.register(devices_1.default, { prefix: '/api/v1/devices' });
        fastify.register(courses_1.default, { prefix: '/api/v1/courses' });
        fastify.register(bundles_1.default, { prefix: '/api/v1/bundles' });
        fastify.register(orders_1.default, { prefix: '/api/v1' });
        fastify.register(admin_1.default, { prefix: '/api/v1' });
        fastify.register(sessions_1.default, { prefix: '/api/v1/sessions' });
        fastify.register(ai_1.default, { prefix: '/api/v1' });
        // 5. Health Check
        fastify.get('/healthcheck', async (request, reply) => {
            const dbStatus = mongoose_1.default.connection.readyState === 1 ? 'ok' : 'disconnected';
            let redisStatus = 'disconnected';
            try {
                if (redis_1.redis && redis_1.redis.status === 'ready') {
                    const pong = await redis_1.redis.ping();
                    if (pong === 'PONG')
                        redisStatus = 'ok';
                }
            }
            catch (err) { /* Redis not available */ }
            const isHealthy = dbStatus === 'ok';
            return reply.status(isHealthy ? 200 : 500).send({
                status: isHealthy ? 'healthy' : 'unhealthy',
                db: dbStatus,
                redis: redisStatus,
                timestamp: new Date().toISOString(),
                env: env_1.env.NODE_ENV,
            });
        });
        // 6. Start Server
        const address = await fastify.listen({ port: env_1.env.PORT, host: '0.0.0.0' });
        console.log(`🚀 RoboAIAPaths LMS Backend listening on ${address}`);
        console.log(`📋 All routes registered: auth, devices, courses, bundles, orders, admin, sessions, ai/notes/bookmarks/progress`);
    }
    catch (err) {
        fastify.log.error(err, 'Bootstrap failed to start');
        process.exit(1);
    }
}
async function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    try {
        await fastify.close();
        await (0, mongodb_1.disconnectDB)();
        if (redis_1.redis && redis_1.redis.status === 'ready') {
            await redis_1.redis.quit();
        }
        process.exit(0);
    }
    catch (err) {
        console.error('❌ Error during graceful shutdown:', err);
        process.exit(1);
    }
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
bootstrap();

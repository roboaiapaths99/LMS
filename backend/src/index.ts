import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import formbody from '@fastify/formbody';
import mongoose from 'mongoose';

import { env } from './config/env';
import { connectDB, disconnectDB } from './db/mongodb';
import { redis } from './db/redis';
import authRoutes from './routes/auth';
import deviceRoutes from './routes/devices';
import courseRoutes from './routes/courses';
import bundleRoutes from './routes/bundles';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import sessionRoutes from './routes/sessions';
import aiNotesRoutes from './routes/ai';
import progressRoutes from './routes/progress';
import bookmarkRoutes from './routes/bookmarks';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

async function bootstrap() {
  try {
    // 1. Connect to Database (MongoDB)
    await connectDB();

    // 2. Register Plugins
    await fastify.register(cors, {
      origin: env.NODE_ENV === 'development' ? true : ['https://roboaiapaths.com', 'https://lms.roboaiapaths.com', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    await fastify.register(cookie, {
      secret: env.JWT_REFRESH_SECRET,
      parseOptions: {},
    });

    // Form body parser (PayU webhook sends application/x-www-form-urlencoded)
    await fastify.register(formbody);

    // Rate Limiting — use Redis if connected, otherwise in-memory
    const rateLimitOpts: any = {
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (req: any) => req.ip,
      errorResponseBuilder: (_req: any, context: any) => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${context.after}.`,
      }),
    };
    if (redis && redis.status === 'ready') {
      rateLimitOpts.redis = redis;
    }
    await fastify.register(rateLimit, rateLimitOpts);

    await fastify.register(websocket);

    await fastify.register(multipart, {
      limits: {
        fileSize: 1024 * 1024 * 500, // 500MB
      }
    });

    // 3. Global Error Handler
    fastify.setErrorHandler((error: any, request, reply) => {
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
        message: env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.',
      });
    });

    // 4. Register All Routes
    fastify.register(authRoutes, { prefix: '/api/v1/auth' });
    fastify.register(deviceRoutes, { prefix: '/api/v1/devices' });
    fastify.register(courseRoutes, { prefix: '/api/v1/courses' });
    fastify.register(bundleRoutes, { prefix: '/api/v1/bundles' });
    fastify.register(orderRoutes, { prefix: '/api/v1' });
    fastify.register(adminRoutes, { prefix: '/api/v1' });
    fastify.register(sessionRoutes, { prefix: '/api/v1/sessions' });
    fastify.register(aiNotesRoutes, { prefix: '/api/v1' });
    fastify.register(progressRoutes, { prefix: '/api/v1/progress' });
    fastify.register(bookmarkRoutes, { prefix: '/api/v1/bookmarks' });

    // 5. Health Check
    fastify.get('/healthcheck', async (request, reply) => {
      const dbStatus = mongoose.connection.readyState === 1 ? 'ok' : 'disconnected';
      let redisStatus = 'disconnected';
      try {
        if (redis && redis.status === 'ready') {
          const pong = await redis.ping();
          if (pong === 'PONG') redisStatus = 'ok';
        }
      } catch (err) { /* Redis not available */ }

      const isHealthy = dbStatus === 'ok';
      return reply.status(isHealthy ? 200 : 500).send({
        status: isHealthy ? 'healthy' : 'unhealthy',
        db: dbStatus,
        redis: redisStatus,
        timestamp: new Date().toISOString(),
        env: env.NODE_ENV,
      });
    });

    // 6. Start Server
    const address = await fastify.listen({ port: env.PORT, host: '::' });
    console.log(`🚀 RoboAIAPaths LMS Backend listening on ${address}`);
    console.log(`📋 All routes registered: auth, devices, courses, bundles, orders, admin, sessions, ai/notes/bookmarks/progress`);

  } catch (err: any) {
    fastify.log.error(err, 'Bootstrap failed to start');
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  try {
    await fastify.close();
    await disconnectDB();
    if (redis && redis.status === 'ready') {
      await redis.quit();
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during graceful shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

bootstrap();

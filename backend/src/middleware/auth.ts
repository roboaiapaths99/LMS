import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { redis } from '../db/redis';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    
    // Check if token is blacklisted in Redis (for logout)
    try {
      if (redis.status === 'ready') {
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
          return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Token revoked' });
        }
      }
    } catch (redisErr) {
       console.warn('Redis unavailable for token blacklist check');
    }

    const decoded = verifyAccessToken(token);
    request.user = decoded;
  } catch (error) {
    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export function authorize(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Not authenticated' });
    }
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient role permissions' });
    }
  };
}

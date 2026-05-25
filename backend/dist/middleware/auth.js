"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const jwt_1 = require("../utils/jwt");
const redis_1 = require("../db/redis");
async function authenticate(request, reply) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing or invalid token' });
        }
        const token = authHeader.split(' ')[1];
        // Check if token is blacklisted in Redis (for logout)
        try {
            if (redis_1.redis.status === 'ready') {
                const isBlacklisted = await redis_1.redis.get(`blacklist:${token}`);
                if (isBlacklisted) {
                    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Token revoked' });
                }
            }
        }
        catch (redisErr) {
            console.warn('Redis unavailable for token blacklist check');
        }
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        request.user = decoded;
    }
    catch (error) {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' });
    }
}
function authorize(roles) {
    return async (request, reply) => {
        if (!request.user) {
            return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Not authenticated' });
        }
        if (!roles.includes(request.user.role)) {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient role permissions' });
        }
    };
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const sms_service_1 = require("../services/sms.service");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const redis_1 = require("../db/redis");
async function authRoutes(fastify) {
    // 1. Request OTP
    fastify.post('/otp/request', async (request, reply) => {
        const schema = zod_1.z.object({ mobile: zod_1.z.string().min(10) });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const { mobile } = parsed.data;
        // Check rate limit if redis is available
        if (redis_1.redis.status === 'ready') {
            const attemptsStr = await redis_1.redis.get(`otp_attempts:${mobile}`);
            const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
            if (attempts >= 5) {
                return reply.status(429).send({ statusCode: 429, error: 'Too Many Requests', message: 'Maximum OTP attempts reached. Try again in 30 minutes.' });
            }
        }
        const otp = (0, sms_service_1.generateOTP)();
        const sent = await (0, sms_service_1.sendOTP)(mobile, otp);
        if (!sent) {
            return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to send OTP' });
        }
        // Store OTP in Redis (5 mins TTL)
        if (redis_1.redis.status === 'ready') {
            await redis_1.redis.set(`otp:${mobile}`, otp, 'EX', 300);
            await redis_1.redis.incr(`otp_attempts:${mobile}`);
            // Set expiry on attempts if it's the first one
            const ttl = await redis_1.redis.ttl(`otp_attempts:${mobile}`);
            if (ttl === -1) {
                await redis_1.redis.expire(`otp_attempts:${mobile}`, 1800); // 30 mins block
            }
        }
        else {
            // Dev mode fallback if no redis
            global.__dev_otp = { [mobile]: otp };
        }
        return reply.status(200).send({ message: 'OTP sent successfully' });
    });
    // 2. Verify OTP
    fastify.post('/otp/verify', async (request, reply) => {
        const schema = zod_1.z.object({
            mobile: zod_1.z.string().min(10),
            otp: zod_1.z.string().length(6),
            deviceId: zod_1.z.string().optional()
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const { mobile, otp, deviceId } = parsed.data;
        // Verify OTP
        let isValid = false;
        if (redis_1.redis.status === 'ready') {
            const storedOtp = await redis_1.redis.get(`otp:${mobile}`);
            if (storedOtp === otp)
                isValid = true;
        }
        else {
            // Dev fallback
            if (global.__dev_otp && global.__dev_otp[mobile] === otp)
                isValid = true;
        }
        if (!isValid) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid or expired OTP' });
        }
        // Strict Admin phone numbers restriction
        const ALLOWED_ADMINS = ['7500059292', '7906681573'];
        const isAdminMobile = ALLOWED_ADMINS.includes(mobile);
        // Find or create user
        let user = await models_1.User.findOne({ mobile });
        if (!user) {
            user = await models_1.User.create({
                mobile,
                role: isAdminMobile ? 'ADMIN' : 'STUDENT',
                isActive: true,
                otpAttempts: 0
            });
        }
        else {
            // Dynamic Role Synchronization & Strict Security Enforcment
            if (isAdminMobile && user.role !== 'ADMIN') {
                user.role = 'ADMIN';
                await user.save();
            }
            else if (!isAdminMobile && user.role === 'ADMIN') {
                user.role = 'STUDENT';
                await user.save();
            }
        }
        if (!user.isActive) {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Account disabled' });
        }
        // Handle Device Binding if provided
        if (deviceId) {
            const existingDevice = await models_1.Device.findOne({ userId: user._id, status: 'ACTIVE' });
            if (existingDevice && existingDevice.deviceId !== deviceId) {
                const deviceRequestToken = jsonwebtoken_1.default.sign({ userId: user._id.toString(), role: user.role, type: 'DEVICE_REQUEST' }, process.env.JWT_SECRET || 'your_secret', { expiresIn: '15m' });
                return reply.status(403).send({
                    statusCode: 403,
                    error: 'Forbidden',
                    message: 'DEVICE_MISMATCH',
                    deviceRequestToken
                });
            }
            if (!existingDevice) {
                await models_1.Device.create({ userId: user._id, deviceId, status: 'ACTIVE' });
            }
        }
        // Generate Tokens
        const payload = { userId: user._id.toString(), role: user.role, deviceId };
        const accessToken = (0, jwt_1.generateAccessToken)(payload);
        const refreshToken = (0, jwt_1.generateRefreshToken)();
        // Store refresh token in redis
        if (redis_1.redis.status === 'ready') {
            await redis_1.redis.set(`refresh:${refreshToken}`, user._id.toString(), 'EX', 7 * 24 * 60 * 60);
            // Clean up OTP
            await redis_1.redis.del(`otp:${mobile}`);
            await redis_1.redis.del(`otp_attempts:${mobile}`);
        }
        reply.setCookie('refreshToken', refreshToken, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60
        });
        return reply.status(200).send({
            message: 'Login successful',
            accessToken,
            user: {
                id: user._id,
                mobile: user.mobile,
                name: user.name,
                role: user.role,
                avatarUrl: user.avatarUrl
            }
        });
    });
    // 3. Refresh Token
    fastify.post('/token/refresh', async (request, reply) => {
        const refreshToken = request.cookies.refreshToken;
        if (!refreshToken) {
            return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'No refresh token provided' });
        }
        if (redis_1.redis.status !== 'ready') {
            return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Redis required for refresh tokens' });
        }
        const userId = await redis_1.redis.get(`refresh:${refreshToken}`);
        if (!userId) {
            return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired refresh token' });
        }
        const user = await models_1.User.findById(userId);
        if (!user || !user.isActive) {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Account disabled' });
        }
        const accessToken = (0, jwt_1.generateAccessToken)({ userId: user._id.toString(), role: user.role });
        return reply.status(200).send({ accessToken });
    });
    // 4. Logout
    fastify.post('/logout', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (authHeader && redis_1.redis.status === 'ready') {
            const token = authHeader.split(' ')[1];
            await redis_1.redis.set(`blacklist:${token}`, '1', 'EX', 24 * 60 * 60); // 24h
        }
        reply.clearCookie('refreshToken', { path: '/' });
        return reply.status(200).send({ message: 'Logged out successfully' });
    });
    // 5. Get Current User (Me)
    fastify.get('/me', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const user = await models_1.User.findById(request.user.userId).select('-__v -otpAttempts');
        if (!user) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
        }
        return reply.status(200).send({ user });
    });
    // 6. Update Current User Profile
    fastify.put('/me', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const schema = zod_1.z.object({
            name: zod_1.z.string().optional(),
            email: zod_1.z.string().email().optional(),
            avatarUrl: zod_1.z.string().url().optional()
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const user = await models_1.User.findByIdAndUpdate(request.user.userId, parsed.data, { new: true }).select('-__v -otpAttempts');
        return reply.status(200).send({ message: 'Profile updated successfully', user });
    });
}

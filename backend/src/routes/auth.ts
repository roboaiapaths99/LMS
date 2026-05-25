import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { User, Device } from '../models';
import { generateOTP, sendOTP } from '../services/sms.service';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import { redis } from '../db/redis';

export default async function authRoutes(fastify: FastifyInstance) {
  
  // 1. Request OTP
  fastify.post('/otp/request', async (request, reply) => {
    const schema = z.object({ mobile: z.string().min(10) });
    const parsed = schema.safeParse(request.body);
    
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
    }
    
    const { mobile } = parsed.data;
    
    // Check rate limit if redis is available
    if (redis.status === 'ready') {
      const attemptsStr = await redis.get(`otp_attempts:${mobile}`);
      const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
      if (attempts >= 5) {
        return reply.status(429).send({ statusCode: 429, error: 'Too Many Requests', message: 'Maximum OTP attempts reached. Try again in 30 minutes.' });
      }
    }
    
    const otp = generateOTP();
    const sent = await sendOTP(mobile, otp);
    
    if (!sent) {
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to send OTP' });
    }
    
    // Store OTP in Redis (5 mins TTL)
    if (redis.status === 'ready') {
      await redis.set(`otp:${mobile}`, otp, 'EX', 300);
      await redis.incr(`otp_attempts:${mobile}`);
      // Set expiry on attempts if it's the first one
      const ttl = await redis.ttl(`otp_attempts:${mobile}`);
      if (ttl === -1) {
        await redis.expire(`otp_attempts:${mobile}`, 1800); // 30 mins block
      }
    } else {
      // Dev mode fallback if no redis
      (global as any).__dev_otp = { [mobile]: otp };
    }
    
    return reply.status(200).send({ message: 'OTP sent successfully' });
  });

  // 2. Verify OTP
  fastify.post('/otp/verify', async (request, reply) => {
    const schema = z.object({
      mobile: z.string().min(10),
      otp: z.string().length(6),
      deviceId: z.string().optional()
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
    }
    
    const { mobile, otp, deviceId } = parsed.data;
    
    // Verify OTP
    let isValid = false;
    if (redis.status === 'ready') {
      const storedOtp = await redis.get(`otp:${mobile}`);
      if (storedOtp === otp) isValid = true;
    } else {
      // Dev fallback
      if ((global as any).__dev_otp && (global as any).__dev_otp[mobile] === otp) isValid = true;
    }
    
    if (!isValid) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid or expired OTP' });
    }
    
    // Strict Admin phone numbers restriction
    const ALLOWED_ADMINS = ['7500059292', '7906681573'];
    const isAdminMobile = ALLOWED_ADMINS.includes(mobile);

    // Find or create user
    let user = await User.findOne({ mobile });
    if (!user) {
      user = await User.create({
        mobile,
        role: isAdminMobile ? 'ADMIN' : 'STUDENT',
        isActive: true,
        otpAttempts: 0
      });
    } else {
      // Dynamic Role Synchronization & Strict Security Enforcment
      if (isAdminMobile && user.role !== 'ADMIN') {
        user.role = 'ADMIN';
        await user.save();
      } else if (!isAdminMobile && user.role === 'ADMIN') {
        user.role = 'STUDENT';
        await user.save();
      }
    }
    
    if (!user.isActive) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Account disabled' });
    }

    // Handle Device Binding if provided
    if (deviceId) {
      const existingDevice = await Device.findOne({ userId: user._id, status: 'ACTIVE' });
      if (existingDevice && existingDevice.deviceId !== deviceId) {
        const deviceRequestToken = jwt.sign(
          { userId: user._id.toString(), role: user.role, type: 'DEVICE_REQUEST' },
          process.env.JWT_SECRET || 'your_secret',
          { expiresIn: '15m' }
        );
        return reply.status(403).send({ 
          statusCode: 403, 
          error: 'Forbidden', 
          message: 'DEVICE_MISMATCH',
          deviceRequestToken 
        });
      }
      if (!existingDevice) {
        await Device.create({ userId: user._id, deviceId, status: 'ACTIVE' });
      }
    }

    // Generate Tokens
    const payload = { userId: user._id.toString(), role: user.role, deviceId };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken();
    
    // Store refresh token in redis
    if (redis.status === 'ready') {
      await redis.set(`refresh:${refreshToken}`, user._id.toString(), 'EX', 7 * 24 * 60 * 60);
      // Clean up OTP
      await redis.del(`otp:${mobile}`);
      await redis.del(`otp_attempts:${mobile}`);
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

    if (redis.status !== 'ready') {
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Redis required for refresh tokens' });
    }

    const userId = await redis.get(`refresh:${refreshToken}`);
    if (!userId) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Account disabled' });
    }

    const accessToken = generateAccessToken({ userId: user._id.toString(), role: user.role });
    return reply.status(200).send({ accessToken });
  });

  // 4. Logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader && redis.status === 'ready') {
      const token = authHeader.split(' ')[1];
      await redis.set(`blacklist:${token}`, '1', 'EX', 24 * 60 * 60); // 24h
    }
    
    reply.clearCookie('refreshToken', { path: '/' });
    return reply.status(200).send({ message: 'Logged out successfully' });
  });

  // 5. Get Current User (Me)
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await User.findById(request.user!.userId).select('-__v -otpAttempts');
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
    }
    return reply.status(200).send({ user });
  });

  // 6. Update Current User Profile
  fastify.put('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const schema = z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      avatarUrl: z.string().url().optional()
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
    }
    
    const user = await User.findByIdAndUpdate(request.user!.userId, parsed.data, { new: true }).select('-__v -otpAttempts');
    return reply.status(200).send({ message: 'Profile updated successfully', user });
  });
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { User, Order, Device, UserCourseAccess, Notification } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { verifyAccessToken } from '../utils/jwt';
import { activeUserSockets, sendSystemNotification } from '../services/notification.service';

export default async function adminRoutes(fastify: FastifyInstance) {

  // ==========================================
  // USER NOTIFICATION ENDPOINTS (Authenticated)
  // ==========================================

  // Get user's notifications
  fastify.get('/notifications', { preHandler: [authenticate] }, async (request, reply) => {
    const notifications = await Notification.find({ userId: request.user!.userId }).sort({ createdAt: -1 });
    return reply.send({ notifications });
  });

  // Mark single notification as read
  fastify.put('/notifications/:id/read', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as any;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: request.user!.userId },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Notification not found' });
    }
    return reply.send({ message: 'Notification marked as read', notification });
  });

  // Mark all notifications as read
  fastify.put('/notifications/read-all', { preHandler: [authenticate] }, async (request, reply) => {
    await Notification.updateMany({ userId: request.user!.userId }, { isRead: true });
    return reply.send({ message: 'All notifications marked as read' });
  });

  // WebSocket route for real-time notifications
  fastify.get('/notifications/ws', { websocket: true }, (connection, req) => {
    req.log.info('WS CONNECT ATTEMPT TO /notifications/ws');
    const socket = (connection as any).socket || connection;
    if (!socket || typeof socket.send !== 'function') {
      return;
    }

    const token = (req.query as any)?.token;
    let userPayload: any = null;
    try {
      if (!token) throw new Error('No authentication token provided');
      userPayload = verifyAccessToken(token);
    } catch (err: any) {
      req.log.error(`WebSocket Auth Error: ${err.message}`);
      try {
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Authentication failed' }));
        socket.close();
      } catch (e) {}
      return;
    }

    const userId = userPayload.userId.toString();
    if (!activeUserSockets.has(userId)) {
      activeUserSockets.set(userId, new Set());
    }
    activeUserSockets.get(userId)!.add(socket);

    if (typeof socket.on === 'function') {
      socket.on('close', () => {
        const clients = activeUserSockets.get(userId);
        if (clients) {
          clients.delete(socket);
          if (clients.size === 0) activeUserSockets.delete(userId);
        }
      });
    }
  });

  // ==========================================
  // ADMINISTRATIVE ROUTES (Admin Only)
  // ==========================================

  fastify.register(async function adminUserRoutes(child) {
    child.addHook('preHandler', authenticate);
    child.addHook('preHandler', authorize(['ADMIN']));

    // List all users with pagination and search filter
    child.get('/users', async (request, reply) => {
      const schema = z.object({
        role: z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT']).optional(),
        search: z.string().optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(10)
      });

      const parsed = schema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const { role, search, page, limit } = parsed.data;
      const filter: any = {};
      
      if (role) filter.role = role;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;
      const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
      const total = await User.countDocuments(filter);

      return reply.send({
        users,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    });

    // Get user details (full record with orders, devices, access lists)
    child.get('/users/:id', async (request, reply) => {
      const { id } = request.params as any;
      const user = await User.findById(id);
      if (!user) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }

      const orders = await Order.find({ userId: id }).populate('bundleId').sort({ createdAt: -1 });
      const devices = await Device.find({ userId: id }).sort({ requestedAt: -1 });
      const courseAccess = await UserCourseAccess.find({ userId: id }).populate('courseId').populate('bundleId');

      return reply.send({
        user,
        orders,
        devices,
        courseAccess
      });
    });

    // Change user role
    child.put('/users/:id/role', async (request, reply) => {
      const { id } = request.params as any;
      const schema = z.object({
        role: z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const user = await User.findByIdAndUpdate(id, { role: parsed.data.role }, { new: true });
      if (!user) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }

      return reply.send({ message: 'User role updated successfully', user });
    });

    // Change user status (Activate/Deactivate)
    child.put('/users/:id/status', async (request, reply) => {
      const { id } = request.params as any;
      const schema = z.object({
        isActive: z.boolean()
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const user = await User.findByIdAndUpdate(id, { isActive: parsed.data.isActive }, { new: true });
      if (!user) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }

      return reply.send({ message: 'User status updated successfully', user });
    });

    // Reset OTP limit attempts
    child.put('/users/:id/reset-otp', async (request, reply) => {
      const { id } = request.params as any;
      const user = await User.findById(id);
      if (!user) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }

      // Reset otpAttempts in schema
      user.otpAttempts = 0;
      await user.save();

      // Clean up Redis blocked state for user mobile if Redis is alive
      const { redis } = require('../db/redis');
      if (redis.status === 'ready') {
        await redis.del(`otp_attempts:${user.mobile}`);
      }

      return reply.send({ message: 'OTP block and attempts reset successfully' });
    });

    // Get user's purchase history specifically
    child.get('/users/:id/purchases', async (request, reply) => {
      const { id } = request.params as any;
      const orders = await Order.find({ userId: id })
        .populate({
          path: 'bundleId',
          populate: { path: 'courseId' }
        })
        .sort({ createdAt: -1 });

      return reply.send({ orders });
    });

    // Send notifications to multiple/single users, or globally
    child.post('/notifications', async (request, reply) => {
      const schema = z.object({
        targetType: z.enum(['ALL', 'ROLE', 'USER']),
        targetRole: z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT']).optional(),
        targetUserId: z.string().optional(),
        title: z.string().min(3),
        message: z.string().min(5),
        type: z.string().default('INFO')
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const { targetType, targetRole, targetUserId, title, message, type } = parsed.data;
      let usersToNotify: any[] = [];

      if (targetType === 'ALL') {
        usersToNotify = await User.find({ isActive: true }, '_id');
      } else if (targetType === 'ROLE' && targetRole) {
        usersToNotify = await User.find({ role: targetRole, isActive: true }, '_id');
      } else if (targetType === 'USER' && targetUserId) {
        usersToNotify = [{ _id: targetUserId }];
      }

      if (usersToNotify.length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No target users found to notify' });
      }

      // Dispatch notifications using the new centralized service
      for (const u of usersToNotify) {
        await sendSystemNotification(u._id.toString(), title, message, type);
      }

      return reply.status(201).send({ message: `Notification successfully sent to ${usersToNotify.length} users` });
    });
  }, { prefix: '/admin' });
}

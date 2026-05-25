"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeUserSockets = void 0;
exports.default = adminRoutes;
const zod_1 = require("zod");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const jwt_1 = require("../utils/jwt");
exports.activeUserSockets = new Map();
async function adminRoutes(fastify) {
    // ==========================================
    // USER NOTIFICATION ENDPOINTS (Authenticated)
    // ==========================================
    // Get user's notifications
    fastify.get('/notifications', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const notifications = await models_1.Notification.find({ userId: request.user.userId }).sort({ createdAt: -1 });
        return reply.send({ notifications });
    });
    // Mark single notification as read
    fastify.put('/notifications/:id/read', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const notification = await models_1.Notification.findOneAndUpdate({ _id: id, userId: request.user.userId }, { isRead: true }, { new: true });
        if (!notification) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Notification not found' });
        }
        return reply.send({ message: 'Notification marked as read', notification });
    });
    // Mark all notifications as read
    fastify.put('/notifications/read-all', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        await models_1.Notification.updateMany({ userId: request.user.userId }, { isRead: true });
        return reply.send({ message: 'All notifications marked as read' });
    });
    // WebSocket route for real-time notifications
    fastify.get('/notifications/ws', { websocket: true }, (connection, req) => {
        const socket = connection.socket || connection;
        if (!socket || typeof socket.send !== 'function') {
            return;
        }
        const token = req.query?.token;
        let userPayload = null;
        try {
            if (!token)
                throw new Error('No authentication token provided');
            userPayload = (0, jwt_1.verifyAccessToken)(token);
        }
        catch (err) {
            try {
                socket.send(JSON.stringify({ type: 'ERROR', message: 'Authentication failed' }));
                socket.close();
            }
            catch (e) { }
            return;
        }
        const userId = userPayload.userId.toString();
        if (!exports.activeUserSockets.has(userId)) {
            exports.activeUserSockets.set(userId, new Set());
        }
        exports.activeUserSockets.get(userId).add(socket);
        if (typeof socket.on === 'function') {
            socket.on('close', () => {
                const clients = exports.activeUserSockets.get(userId);
                if (clients) {
                    clients.delete(socket);
                    if (clients.size === 0)
                        exports.activeUserSockets.delete(userId);
                }
            });
        }
    });
    // ==========================================
    // ADMINISTRATIVE ROUTES (Admin Only)
    // ==========================================
    fastify.register(async function adminUserRoutes(child) {
        child.addHook('preHandler', auth_1.authenticate);
        child.addHook('preHandler', (0, auth_1.authorize)(['ADMIN']));
        // List all users with pagination and search filter
        child.get('/users', async (request, reply) => {
            const schema = zod_1.z.object({
                role: zod_1.z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT']).optional(),
                search: zod_1.z.string().optional(),
                page: zod_1.z.coerce.number().default(1),
                limit: zod_1.z.coerce.number().default(10)
            });
            const parsed = schema.safeParse(request.query);
            if (!parsed.success) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
            }
            const { role, search, page, limit } = parsed.data;
            const filter = {};
            if (role)
                filter.role = role;
            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { mobile: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }
            const skip = (page - 1) * limit;
            const users = await models_1.User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
            const total = await models_1.User.countDocuments(filter);
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
            const { id } = request.params;
            const user = await models_1.User.findById(id);
            if (!user) {
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
            }
            const orders = await models_1.Order.find({ userId: id }).populate('bundleId').sort({ createdAt: -1 });
            const devices = await models_1.Device.find({ userId: id }).sort({ requestedAt: -1 });
            const courseAccess = await models_1.UserCourseAccess.find({ userId: id }).populate('courseId').populate('bundleId');
            return reply.send({
                user,
                orders,
                devices,
                courseAccess
            });
        });
        // Change user role
        child.put('/users/:id/role', async (request, reply) => {
            const { id } = request.params;
            const schema = zod_1.z.object({
                role: zod_1.z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
            }
            const user = await models_1.User.findByIdAndUpdate(id, { role: parsed.data.role }, { new: true });
            if (!user) {
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
            }
            return reply.send({ message: 'User role updated successfully', user });
        });
        // Change user status (Activate/Deactivate)
        child.put('/users/:id/status', async (request, reply) => {
            const { id } = request.params;
            const schema = zod_1.z.object({
                isActive: zod_1.z.boolean()
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
            }
            const user = await models_1.User.findByIdAndUpdate(id, { isActive: parsed.data.isActive }, { new: true });
            if (!user) {
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
            }
            return reply.send({ message: 'User status updated successfully', user });
        });
        // Reset OTP limit attempts
        child.put('/users/:id/reset-otp', async (request, reply) => {
            const { id } = request.params;
            const user = await models_1.User.findById(id);
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
            const { id } = request.params;
            const orders = await models_1.Order.find({ userId: id })
                .populate({
                path: 'bundleId',
                populate: { path: 'courseId' }
            })
                .sort({ createdAt: -1 });
            return reply.send({ orders });
        });
        // Send notifications to multiple/single users, or globally
        child.post('/notifications', async (request, reply) => {
            const schema = zod_1.z.object({
                targetType: zod_1.z.enum(['ALL', 'ROLE', 'USER']),
                targetRole: zod_1.z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT']).optional(),
                targetUserId: zod_1.z.string().optional(),
                title: zod_1.z.string().min(3),
                message: zod_1.z.string().min(5),
                type: zod_1.z.string().default('INFO')
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
            }
            const { targetType, targetRole, targetUserId, title, message, type } = parsed.data;
            let usersToNotify = [];
            if (targetType === 'ALL') {
                usersToNotify = await models_1.User.find({ isActive: true }, '_id');
            }
            else if (targetType === 'ROLE' && targetRole) {
                usersToNotify = await models_1.User.find({ role: targetRole, isActive: true }, '_id');
            }
            else if (targetType === 'USER' && targetUserId) {
                usersToNotify = [{ _id: targetUserId }];
            }
            if (usersToNotify.length === 0) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No target users found to notify' });
            }
            const notificationOps = usersToNotify.map(u => ({
                userId: u._id,
                title,
                message,
                type,
                isRead: false,
            }));
            const notifications = await models_1.Notification.insertMany(notificationOps);
            // Dispatch notifications in real-time to active user sockets
            for (const notif of notifications) {
                const uId = notif.userId.toString();
                const sockets = exports.activeUserSockets.get(uId);
                if (sockets) {
                    const payload = JSON.stringify({
                        type: 'NOTIFICATION_RECEIVED',
                        notification: notif
                    });
                    for (const socket of sockets) {
                        try {
                            socket.send(payload);
                        }
                        catch (err) {
                            // Socket might be closed/stale
                        }
                    }
                }
            }
            return reply.status(201).send({ message: `Notification successfully sent to ${usersToNotify.length} users` });
        });
    });
}

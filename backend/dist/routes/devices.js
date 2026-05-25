"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = deviceRoutes;
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const env_1 = require("../config/env");
async function deviceRoutes(fastify) {
    // 1. Request new device binding
    fastify.post('/request', async (request, reply) => {
        const schema = zod_1.z.object({
            deviceRequestToken: zod_1.z.string(),
            newDeviceId: zod_1.z.string(),
            deviceName: zod_1.z.string().optional()
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        try {
            const decoded = jsonwebtoken_1.default.verify(parsed.data.deviceRequestToken, env_1.env.JWT_SECRET);
            if (decoded.type !== 'DEVICE_REQUEST')
                throw new Error('Invalid token type');
            const existingRequest = await models_1.Device.findOne({ userId: decoded.userId, status: 'PENDING' });
            if (existingRequest) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'You already have a pending device request.' });
            }
            const device = await models_1.Device.create({
                userId: decoded.userId,
                deviceId: parsed.data.newDeviceId,
                deviceName: parsed.data.deviceName,
                status: 'PENDING'
            });
            await models_1.AuditLog.create({
                userId: decoded.userId,
                action: 'DEVICE_BIND_REQUEST',
                entityType: 'DEVICE',
                entityId: device._id.toString(),
                ipAddress: request.ip
            });
            return reply.status(200).send({ message: 'Device binding requested successfully. Please wait for admin approval.', requestId: device._id });
        }
        catch (err) {
            return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired device request token' });
        }
    });
    // 2. Check Device
    fastify.post('/check', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const schema = zod_1.z.object({ deviceId: zod_1.z.string() });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        const device = await models_1.Device.findOne({ userId: request.user.userId, status: 'ACTIVE' });
        if (!device || device.deviceId !== parsed.data.deviceId) {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'DEVICE_MISMATCH' });
        }
        return reply.status(200).send({ message: 'Device OK' });
    });
    // Admin routes
    fastify.register(async function adminDeviceRoutes(child) {
        child.addHook('preHandler', auth_1.authenticate);
        child.addHook('preHandler', (0, auth_1.authorize)(['ADMIN']));
        child.get('/requests', async (request, reply) => {
            const requests = await models_1.Device.find({ status: 'PENDING' }).populate('userId', 'name mobile email').sort({ requestedAt: -1 });
            return reply.send({ requests });
        });
        child.get('/requests/:id', async (request, reply) => {
            const { id } = request.params;
            const deviceRequest = await models_1.Device.findById(id).populate('userId', 'name mobile email');
            if (!deviceRequest)
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Request not found' });
            return reply.send({ deviceRequest });
        });
        child.put('/:id/approve', async (request, reply) => {
            const { id } = request.params;
            const deviceRequest = await models_1.Device.findById(id);
            if (!deviceRequest || deviceRequest.status !== 'PENDING') {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid request' });
            }
            // Deactivate old devices
            await models_1.Device.updateMany({ userId: deviceRequest.userId, _id: { $ne: deviceRequest._id } }, { status: 'REJECTED' });
            deviceRequest.status = 'ACTIVE';
            deviceRequest.approvedAt = new Date();
            deviceRequest.approvedBy = request.user.userId;
            await deviceRequest.save();
            await models_1.AuditLog.create({
                userId: request.user.userId,
                action: 'DEVICE_APPROVE',
                entityType: 'DEVICE',
                entityId: deviceRequest._id.toString(),
                ipAddress: request.ip
            });
            return reply.send({ message: 'Device approved', deviceRequest });
        });
        child.put('/:id/reject', async (request, reply) => {
            const { id } = request.params;
            const schema = zod_1.z.object({ reason: zod_1.z.string().optional() });
            const parsed = schema.safeParse(request.body);
            const reason = parsed.success && parsed.data.reason ? parsed.data.reason : 'Rejected by Admin';
            const deviceRequest = await models_1.Device.findById(id);
            if (!deviceRequest || deviceRequest.status !== 'PENDING') {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid request' });
            }
            deviceRequest.status = 'REJECTED';
            deviceRequest.rejectionReason = reason;
            await deviceRequest.save();
            await models_1.AuditLog.create({
                userId: request.user.userId,
                action: 'DEVICE_REJECT',
                entityType: 'DEVICE',
                entityId: deviceRequest._id.toString(),
                details: { reason },
                ipAddress: request.ip
            });
            return reply.send({ message: 'Device rejected', deviceRequest });
        });
        child.post('/:userId/forcelogout', async (request, reply) => {
            const { userId } = request.params;
            // Force logout implies rejecting all active devices so next login fails device check.
            await models_1.Device.updateMany({ userId, status: 'ACTIVE' }, { status: 'REJECTED', rejectionReason: 'Force Logout' });
            await models_1.AuditLog.create({
                userId: request.user.userId,
                action: 'FORCE_LOGOUT',
                entityType: 'USER',
                entityId: userId,
                ipAddress: request.ip
            });
            return reply.send({ message: 'User force logged out (devices revoked)' });
        });
        child.get('/log', async (request, reply) => {
            const logs = await models_1.AuditLog.find({ entityType: 'DEVICE' }).populate('userId', 'name').sort({ createdAt: -1 }).limit(100);
            return reply.send({ logs });
        });
    }, { prefix: '/admin/devices' });
}

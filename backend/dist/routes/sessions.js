"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = sessionRoutes;
const zod_1 = require("zod");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const livekit_service_1 = require("../services/livekit.service");
const jwt_1 = require("../utils/jwt");
const crypto_1 = __importDefault(require("crypto"));
// In-memory active socket connections mapped by sessionId
const activeSessions = new Map();
async function sessionRoutes(fastify) {
    // List upcoming/active live sessions
    fastify.get('/', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { role, userId } = request.user;
        let sessions = [];
        if (role === 'ADMIN') {
            sessions = await models_1.LiveSession.find().populate('instructorId', 'name avatarUrl').populate('courseId', 'title');
        }
        else {
            // Find all courses the user has access to
            let courseIds = [];
            if (role === 'INSTRUCTOR') {
                sessions = await models_1.LiveSession.find({ instructorId: userId })
                    .populate('instructorId', 'name avatarUrl')
                    .populate('courseId', 'title');
            }
            else {
                const accesses = await models_1.UserCourseAccess.find({ userId });
                courseIds = accesses.map(a => a.courseId);
                sessions = await models_1.LiveSession.find({
                    $or: [
                        { courseId: { $in: courseIds } },
                        { type: 'OPEN' }
                    ]
                })
                    .populate('instructorId', 'name avatarUrl')
                    .populate('courseId', 'title')
                    .sort({ scheduledAt: -1 });
            }
        }
        return reply.send({ sessions });
    });
    // Get session details + Join Token
    fastify.get('/:id', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const { userId, role } = request.user;
        const session = await models_1.LiveSession.findById(id)
            .populate('instructorId', 'name avatarUrl')
            .populate('courseId', 'title');
        if (!session) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Session not found' });
        }
        // Access control
        if (role === 'STUDENT') {
            const access = await models_1.UserCourseAccess.findOne({ userId, courseId: session.courseId });
            const inviteToken = request.query?.invite;
            const hasInvite = inviteToken && session.inviteToken && inviteToken === session.inviteToken;
            if (session.type !== 'OPEN' && !access && !hasInvite) {
                return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'You do not have access to this course live session' });
            }
        }
        const user = await models_1.User.findById(userId);
        const userName = user ? user.name || 'Participant' : 'Participant';
        // Generate LiveKit Join Token
        const isInstructor = role === 'ADMIN' || (role === 'INSTRUCTOR' && session.instructorId._id.toString() === userId);
        let joinToken = '';
        if (session.status === 'LIVE' || isInstructor) {
            joinToken = (0, livekit_service_1.generateLiveKitToken)({
                roomName: session._id.toString(),
                participantIdentity: userId,
                participantName: userName,
                isInstructor
            });
        }
        return reply.send({ session, joinToken });
    });
    // Create live session (Instructor/Admin)
    fastify.post('/', { preHandler: [auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'INSTRUCTOR'])] }, async (request, reply) => {
        const schema = zod_1.z.object({
            courseId: zod_1.z.string(),
            title: zod_1.z.string().min(3),
            description: zod_1.z.string().optional(),
            type: zod_1.z.enum(['INVITE', 'OPEN']).default('OPEN'),
            scheduledAt: zod_1.z.string(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const session = await models_1.LiveSession.create({
            ...parsed.data,
            instructorId: request.user.userId,
            status: 'SCHEDULED',
            scheduledAt: new Date(parsed.data.scheduledAt),
            inviteToken: parsed.data.type === 'INVITE' ? crypto_1.default.randomBytes(16).toString('hex') : undefined
        });
        return reply.status(201).send({ message: 'Live session scheduled successfully', session });
    });
    // Start Live Session (Instructor/Admin)
    fastify.post('/:id/start', { preHandler: [auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'INSTRUCTOR'])] }, async (request, reply) => {
        const { id } = request.params;
        const session = await models_1.LiveSession.findById(id);
        if (!session) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Session not found' });
        }
        if (request.user.role !== 'ADMIN' && session.instructorId.toString() !== request.user.userId) {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the assigned instructor can start the session' });
        }
        session.status = 'LIVE';
        session.startedAt = new Date();
        await session.save();
        return reply.send({ message: 'Live session started successfully', session });
    });
    // End Live Session (Instructor/Admin)
    fastify.post('/:id/end', { preHandler: [auth_1.authenticate, (0, auth_1.authorize)(['ADMIN', 'INSTRUCTOR'])] }, async (request, reply) => {
        const { id } = request.params;
        const session = await models_1.LiveSession.findById(id);
        if (!session) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Session not found' });
        }
        if (request.user.role !== 'ADMIN' && session.instructorId.toString() !== request.user.userId) {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the assigned instructor can end the session' });
        }
        session.status = 'ENDED';
        session.endedAt = new Date();
        // Generate AI Summary Mock
        const chatMessages = await models_1.SessionChatMessage.find({ sessionId: id }).populate('userId', 'name');
        const chatTranscript = chatMessages.map(m => `${m.userId?.name || 'User'}: ${m.message}`).join('\n');
        session.aiSummary = `### RoboAIAPaths Live Session Summary\n\n**Topic:** ${session.title}\n\n**Key Takeaways:**\n- Completed detailed demonstration of the robotics hardware.\n- Handled student questions about sensor calibrations and layout wiring.\n- Reviewed project paths for the final AI build.\n\n**Discussion Log Points:**\n${chatTranscript ? 'Based on chat dialogue, students requested extra documentation on model loading.' : 'No active chat inquiries were logged during this session.'}`;
        await session.save();
        // Notify all active socket participants that the session has ended
        const clients = activeSessions.get(id);
        if (clients) {
            const message = JSON.stringify({ type: 'SYSTEM', content: 'SESSION_ENDED' });
            for (const client of clients) {
                if (client.readyState === 1)
                    client.send(message);
            }
            activeSessions.delete(id);
        }
        return reply.send({ message: 'Live session ended successfully', session });
    });
    // Get Session Summary
    fastify.get('/:id/summary', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const session = await models_1.LiveSession.findById(id);
        if (!session) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Session not found' });
        }
        return reply.send({ aiSummary: session.aiSummary });
    });
    // Get Session Chat Messages (Historical)
    fastify.get('/:id/chat/history', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const messages = await models_1.SessionChatMessage.find({ sessionId: id })
            .populate('userId', 'name role avatarUrl')
            .sort({ sentAt: 1 });
        return reply.send({ messages });
    });
    // Force terminate session (Admin Only)
    fastify.post('/admin/sessions/:id/terminate', { preHandler: [auth_1.authenticate, (0, auth_1.authorize)(['ADMIN'])] }, async (request, reply) => {
        const { id } = request.params;
        const session = await models_1.LiveSession.findById(id);
        if (!session)
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Session not found' });
        session.status = 'ENDED';
        session.endedAt = new Date();
        await session.save();
        const clients = activeSessions.get(id);
        if (clients) {
            const message = JSON.stringify({ type: 'SYSTEM', content: 'SESSION_TERMINATED' });
            for (const client of clients) {
                if (client.readyState === 1)
                    client.send(message);
            }
            activeSessions.delete(id);
        }
        return reply.send({ message: 'Session terminated by Administrator', session });
    });
    // ==========================================
    // WEBSOCKET LIVE CHAT ROOM (Upgrade Handler)
    // ==========================================
    fastify.get('/:id/chat', { websocket: true }, (connection, req) => {
        const { id: sessionId } = req.params;
        const socket = connection.socket || connection;
        if (!socket || typeof socket.send !== 'function') {
            return;
        }
        // Since browser standard WS clients cannot easily send custom headers, we pull JWT from query params (?token=...)
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
        // Register active connection
        if (!activeSessions.has(sessionId)) {
            activeSessions.set(sessionId, new Set());
        }
        activeSessions.get(sessionId).add(socket);
        fastify.log.info(`WebSocket User ${userPayload.userId} joined Session ${sessionId}`);
        if (typeof socket.on === 'function') {
            socket.on('message', async (rawMsg) => {
                try {
                    const parsed = JSON.parse(rawMsg.toString());
                    if (parsed.type === 'CHAT') {
                        // Fetch full user details to populate
                        const user = await models_1.User.findById(userPayload.userId);
                        if (!user)
                            return;
                        // Save message to DB
                        const messageObj = await models_1.SessionChatMessage.create({
                            sessionId,
                            userId: userPayload.userId,
                            message: parsed.content,
                            sentAt: new Date()
                        });
                        // Broadcast to all active participants in session room
                        const clients = activeSessions.get(sessionId);
                        if (clients) {
                            const broadcastPayload = JSON.stringify({
                                type: 'CHAT',
                                message: {
                                    id: messageObj._id,
                                    message: messageObj.message,
                                    sentAt: messageObj.sentAt,
                                    user: {
                                        id: user._id,
                                        name: user.name || 'Student',
                                        role: user.role,
                                        avatarUrl: user.avatarUrl
                                    }
                                }
                            });
                            for (const client of clients) {
                                if (client.readyState === 1) { // OPEN
                                    client.send(broadcastPayload);
                                }
                            }
                        }
                    }
                }
                catch (err) {
                    fastify.log.error(err, 'WebSocket message parsing error');
                }
            });
        }
        if (typeof socket.on === 'function') {
            socket.on('close', () => {
                const clients = activeSessions.get(sessionId);
                if (clients) {
                    clients.delete(socket);
                    if (clients.size === 0) {
                        activeSessions.delete(sessionId);
                    }
                }
                fastify.log.info(`WebSocket User ${userPayload.userId} left Session ${sessionId}`);
            });
        }
    });
}

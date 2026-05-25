"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = bundleRoutes;
const zod_1 = require("zod");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
async function bundleRoutes(fastify) {
    // Public/User: List bundles for a course
    fastify.get('/:courseId', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { courseId } = request.params;
        if (!require('mongoose').Types.ObjectId.isValid(courseId)) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid course ID format' });
        }
        // Verify course exists and matches role visibility
        const course = await models_1.Course.findById(courseId);
        if (!course) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Course not found' });
        }
        const { role } = request.user;
        if (role === 'STUDENT' && course.visibility === 'INSTRUCTOR') {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Students do not have access to this course bundles' });
        }
        if (role === 'INSTRUCTOR' && course.visibility === 'STUDENT') {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Instructors do not have access to this course bundles' });
        }
        let query = { courseId, isActive: true };
        if (role === 'INSTRUCTOR') {
            // Instructors can only see COMBO or PDF_ONLY
            query.type = { $in: ['COMBO', 'PDF_ONLY'] };
        }
        else if (role === 'STUDENT') {
            // Students can only see COMBO or VIDEO_ONLY
            query.type = { $in: ['COMBO', 'VIDEO_ONLY'] };
        }
        const bundles = await models_1.Bundle.find(query);
        return reply.send({ bundles });
    });
    // Admin/Instructor Routes
    fastify.register(async function bundleAdminRoutes(child) {
        child.addHook('preHandler', auth_1.authenticate);
        child.addHook('preHandler', (0, auth_1.authorize)(['ADMIN', 'INSTRUCTOR']));
        // Create Bundle
        child.post('/', async (request, reply) => {
            const schema = zod_1.z.object({
                courseId: zod_1.z.string(),
                name: zod_1.z.string().min(3),
                type: zod_1.z.enum(['VIDEO_ONLY', 'PDF_ONLY', 'COMBO']),
                priceInr: zod_1.z.number().min(0),
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
            }
            const course = await models_1.Course.findById(parsed.data.courseId);
            if (!course) {
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Course not found' });
            }
            const bundle = await models_1.Bundle.create({
                ...parsed.data,
                isActive: true
            });
            return reply.status(201).send({ message: 'Bundle created successfully', bundle });
        });
        // Update Bundle
        child.put('/:id', async (request, reply) => {
            const { id } = request.params;
            if (!require('mongoose').Types.ObjectId.isValid(id)) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid bundle ID format' });
            }
            const schema = zod_1.z.object({
                name: zod_1.z.string().min(3).optional(),
                type: zod_1.z.enum(['VIDEO_ONLY', 'PDF_ONLY', 'COMBO']).optional(),
                priceInr: zod_1.z.number().min(0).optional(),
                isActive: zod_1.z.boolean().optional(),
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
            }
            const bundle = await models_1.Bundle.findByIdAndUpdate(id, parsed.data, { new: true });
            if (!bundle) {
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Bundle not found' });
            }
            return reply.send({ message: 'Bundle updated successfully', bundle });
        });
        // Deactivate Bundle (Soft Delete)
        child.delete('/:id', async (request, reply) => {
            const { id } = request.params;
            if (!require('mongoose').Types.ObjectId.isValid(id)) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid bundle ID format' });
            }
            const bundle = await models_1.Bundle.findByIdAndUpdate(id, { isActive: false }, { new: true });
            if (!bundle) {
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Bundle not found' });
            }
            return reply.send({ message: 'Bundle deactivated successfully', bundle });
        });
    });
}

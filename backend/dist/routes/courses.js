"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = courseRoutes;
const zod_1 = require("zod");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const storage_service_1 = require("../services/storage.service");
const pdf_service_1 = require("../services/pdf.service");
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
async function courseRoutes(fastify) {
    // Public: Get categories
    fastify.get('/categories', async (request, reply) => {
        const categories = await models_1.Course.distinct('category', { status: 'PUBLISHED' });
        return reply.send({ categories });
    });
    // ==========================================
    // PUBLIC ENDPOINTS (No Auth Required)
    // ==========================================
    // Public: List published courses (for landing page)
    fastify.get('/public', async (request, reply) => {
        const { category, featured } = request.query;
        const filter = { status: 'PUBLISHED' };
        if (category)
            filter.category = category;
        if (featured === 'true')
            filter.isFeatured = true;
        const courses = await models_1.Course.find(filter)
            .populate('createdBy', 'name avatarUrl')
            .sort({ createdAt: -1 });
        // Also fetch bundle pricing for each course (min price)
        const Bundle = require('mongoose').model('Bundle');
        const coursesWithPrice = await Promise.all(courses.map(async (course) => {
            const cheapestBundle = await Bundle.findOne({ courseId: course._id, isActive: true })
                .sort({ priceInr: 1 })
                .select('priceInr name type');
            return {
                ...course.toObject(),
                startingPrice: cheapestBundle?.priceInr || null,
                bundleCount: await Bundle.countDocuments({ courseId: course._id, isActive: true }),
            };
        }));
        return reply.send({ courses: coursesWithPrice });
    });
    // Public: Get single course detail with lessons and bundles (for public course preview)
    fastify.get('/public/:id', async (request, reply) => {
        const { id } = request.params;
        if (!require('mongoose').Types.ObjectId.isValid(id)) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid course ID format' });
        }
        const course = await models_1.Course.findOne({ _id: id, status: 'PUBLISHED' })
            .populate('createdBy', 'name avatarUrl');
        if (!course) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Course not found' });
        }
        // Get lessons (titles only, no storage paths for security)
        const lessons = await models_1.Lesson.find({ courseId: id })
            .select('title type orderIndex')
            .sort({ orderIndex: 1 });
        // Get active bundles with pricing
        const Bundle = require('mongoose').model('Bundle');
        const bundles = await Bundle.find({ courseId: id, isActive: true }).sort({ priceInr: 1 });
        return reply.send({ course, lessons, bundles });
    });
    // User: List courses
    fastify.get('/', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { role } = request.user;
        const { featured } = request.query;
        let filter = { status: 'PUBLISHED' };
        // Admins see all courses, including drafts
        if (role === 'ADMIN') {
            filter = {};
        }
        else if (role === 'INSTRUCTOR') {
            filter.visibility = { $in: ['INSTRUCTOR', 'BOTH'] };
        }
        else {
            filter.visibility = { $in: ['STUDENT', 'BOTH'] };
        }
        if (featured === 'true') {
            filter.isFeatured = true;
        }
        const courses = await models_1.Course.find(filter)
            .populate('createdBy', 'name avatarUrl')
            .sort({ createdAt: -1 });
        return reply.send({ courses });
    });
    // User: Get course detail
    fastify.get('/:id', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        if (!require('mongoose').Types.ObjectId.isValid(id)) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid course ID format' });
        }
        const course = await models_1.Course.findById(id).populate('createdBy', 'name avatarUrl');
        if (!course) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Course not found' });
        }
        const { role, userId } = request.user;
        // Strict role-based visibility check
        if (role === 'STUDENT' && course.visibility === 'INSTRUCTOR') {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Students do not have access to this course' });
        }
        if (role === 'INSTRUCTOR' && course.visibility === 'STUDENT') {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Instructors do not have access to this course' });
        }
        // Role check logic for draft status
        if (role !== 'ADMIN' && course.status === 'DRAFT') {
            return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Course is not published' });
        }
        const lessons = await models_1.Lesson.find({ courseId: id }).sort({ orderIndex: 1 });
        return reply.send({ course, lessons });
    });
    // User: Stream video lesson
    fastify.get('/:id/stream/:lessonId', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id, lessonId } = request.params;
        if (!require('mongoose').Types.ObjectId.isValid(id) || !require('mongoose').Types.ObjectId.isValid(lessonId)) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid course or lesson ID format' });
        }
        const lesson = await models_1.Lesson.findOne({ _id: lessonId, courseId: id, type: 'VIDEO' });
        if (!lesson)
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Video not found' });
        // Check if user has access (either bought the bundle, or is admin/instructor)
        const { role, userId } = request.user;
        if (role === 'STUDENT' || role === 'INSTRUCTOR') {
            const access = await models_1.UserCourseAccess.findOne({
                userId,
                courseId: id,
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            });
            if (!access)
                return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'You do not have access to this course. Please purchase it first.' });
            if (access.accessType === 'PDF_ONLY') {
                return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Your purchase access is restricted to PDF materials only.' });
            }
        }
        // In a real app we would stream HLS. Here we just serve the MP4 via read stream
        const fullPath = path_1.default.resolve(process.cwd(), lesson.storagePath.replace(/^\//, ''));
        if (!require('fs').existsSync(fullPath)) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'File missing on server' });
        }
        reply.header('Content-Type', 'video/mp4');
        return reply.send(require('fs').createReadStream(fullPath));
    });
    // User: View PDF lesson
    fastify.get('/:id/pdf/:lessonId', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id, lessonId } = request.params;
        if (!require('mongoose').Types.ObjectId.isValid(id) || !require('mongoose').Types.ObjectId.isValid(lessonId)) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid course or lesson ID format' });
        }
        const lesson = await models_1.Lesson.findOne({ _id: lessonId, courseId: id, type: 'PDF' });
        if (!lesson)
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'PDF not found' });
        const { role, userId } = request.user;
        if (role === 'STUDENT' || role === 'INSTRUCTOR') {
            const access = await models_1.UserCourseAccess.findOne({
                userId,
                courseId: id,
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            });
            if (!access)
                return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'You do not have access to this course. Please purchase it first.' });
            if (access.accessType === 'VIDEO_ONLY') {
                return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Your purchase access is restricted to video materials only.' });
            }
        }
        const fullPath = path_1.default.resolve(process.cwd(), lesson.storagePath.replace(/^\//, ''));
        if (!require('fs').existsSync(fullPath)) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'File missing on server' });
        }
        try {
            const user = await models_1.User.findById(userId);
            const watermarkText = user
                ? `${user.name || 'Student'} (${user.mobile}) - RoboAIAPaths LMS`
                : `RoboAIAPaths LMS User - ${userId}`;
            const watermarkedBuffer = await (0, pdf_service_1.watermarkPDF)(fullPath, watermarkText);
            reply.header('Content-Type', 'application/pdf');
            return reply.send(watermarkedBuffer);
        }
        catch (err) {
            // Fallback in case of PDF parsing error
            fastify.log.error(err, 'PDF watermarking failed, falling back to clean stream');
            reply.header('Content-Type', 'application/pdf');
            return reply.send(require('fs').createReadStream(fullPath));
        }
    });
    // Rest are Admin/Instructor routes
    fastify.register(async function courseAdminRoutes(child) {
        child.addHook('preHandler', auth_1.authenticate);
        // PRD says instructors can also upload content. So authorize ADMIN and INSTRUCTOR
        child.addHook('preHandler', (0, auth_1.authorize)(['ADMIN', 'INSTRUCTOR']));
        // Course ID validation preHandler hook
        child.addHook('preHandler', async (request, reply) => {
            const { id } = request.params;
            if (id && !require('mongoose').Types.ObjectId.isValid(id)) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid course ID format' });
            }
        });
        // Create course
        child.post('/', async (request, reply) => {
            const schema = zod_1.z.object({
                title: zod_1.z.string().min(3),
                description: zod_1.z.string().optional(),
                category: zod_1.z.string().optional(),
                visibility: zod_1.z.enum(['STUDENT', 'INSTRUCTOR', 'BOTH']).default('STUDENT')
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success)
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
            const course = await models_1.Course.create({
                ...parsed.data,
                createdBy: request.user.userId,
                status: 'DRAFT'
            });
            await models_1.AuditLog.create({
                userId: request.user.userId,
                action: 'COURSE_CREATE',
                entityType: 'COURSE',
                entityId: course._id.toString(),
                ipAddress: request.ip
            });
            return reply.status(201).send({ message: 'Course created successfully', course });
        });
        // Update course
        child.put('/:id', async (request, reply) => {
            const { id } = request.params;
            const schema = zod_1.z.object({
                title: zod_1.z.string().min(3).optional(),
                description: zod_1.z.string().optional(),
                category: zod_1.z.string().optional(),
                visibility: zod_1.z.enum(['STUDENT', 'INSTRUCTOR', 'BOTH']).optional(),
                status: zod_1.z.enum(['DRAFT', 'PUBLISHED']).optional(),
                isFeatured: zod_1.z.boolean().optional()
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success)
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
            const course = await models_1.Course.findByIdAndUpdate(id, parsed.data, { new: true });
            if (!course)
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Course not found' });
            return reply.send({ message: 'Course updated', course });
        });
        // Upload Thumbnail
        child.post('/:id/thumbnail', async (request, reply) => {
            const { id } = request.params;
            const data = await request.file();
            if (!data)
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
            const ext = path_1.default.extname(data.filename) || '.jpg';
            const filename = `${id}_thumb_${Date.now()}${ext}`;
            const url = await (0, storage_service_1.saveLocalFile)(data.file, filename, 'thumbnails');
            const course = await models_1.Course.findByIdAndUpdate(id, { thumbnailUrl: url }, { new: true });
            return reply.send({ message: 'Thumbnail uploaded', url, course });
        });
        // Upload Video Lesson
        child.post('/:id/videos', async (request, reply) => {
            const { id } = request.params;
            const data = await request.file();
            if (!data)
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
            // In a real app with BullMQ and FFmpeg, we save to temp, then trigger a BullMQ job to transcode to HLS.
            // Since we are mocking the transcode here for simplicity, we just save the raw MP4 and create a lesson.
            const ext = path_1.default.extname(data.filename) || '.mp4';
            const filename = `vid_${crypto_1.default.randomUUID()}${ext}`;
            const storagePath = await (0, storage_service_1.saveLocalFile)(data.file, filename, `courses/${id}/videos`);
            // Get highest orderIndex
            const lastLesson = await models_1.Lesson.findOne({ courseId: id }).sort({ orderIndex: -1 });
            const orderIndex = lastLesson ? lastLesson.orderIndex + 1 : 0;
            const lesson = await models_1.Lesson.create({
                courseId: id,
                title: data.filename, // Temporary title
                type: 'VIDEO',
                storagePath,
                orderIndex
            });
            return reply.send({ message: 'Video uploaded and processing started', lesson });
        });
        // Upload PDF Lesson
        child.post('/:id/pdfs', async (request, reply) => {
            const { id } = request.params;
            const data = await request.file();
            if (!data)
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
            const ext = path_1.default.extname(data.filename) || '.pdf';
            const filename = `pdf_${crypto_1.default.randomUUID()}${ext}`;
            const storagePath = await (0, storage_service_1.saveLocalFile)(data.file, filename, `courses/${id}/pdfs`);
            const lastLesson = await models_1.Lesson.findOne({ courseId: id }).sort({ orderIndex: -1 });
            const orderIndex = lastLesson ? lastLesson.orderIndex + 1 : 0;
            const lesson = await models_1.Lesson.create({
                courseId: id,
                title: data.filename,
                type: 'PDF',
                storagePath,
                orderIndex
            });
            return reply.send({ message: 'PDF uploaded', lesson });
        });
        // Reorder Lessons
        child.put('/:id/lessons/reorder', async (request, reply) => {
            const { id } = request.params;
            const schema = zod_1.z.object({
                lessonIds: zod_1.z.array(zod_1.z.string())
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success)
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid lessonIds array' });
            // Update each lesson's orderIndex
            const ops = parsed.data.lessonIds.map((lessonId, index) => ({
                updateOne: {
                    filter: { _id: lessonId, courseId: id },
                    update: { $set: { orderIndex: index } }
                }
            }));
            if (ops.length > 0) {
                await models_1.Lesson.bulkWrite(ops);
            }
            return reply.send({ message: 'Lessons reordered successfully' });
        });
        // Update Lesson (e.g. rename title)
        child.put('/:id/lessons/:lessonId', async (request, reply) => {
            const { id, lessonId } = request.params;
            if (!require('mongoose').Types.ObjectId.isValid(lessonId)) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid lesson ID format' });
            }
            const schema = zod_1.z.object({
                title: zod_1.z.string().min(1)
            });
            const parsed = schema.safeParse(request.body);
            if (!parsed.success)
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid title' });
            const lesson = await models_1.Lesson.findOneAndUpdate({ _id: lessonId, courseId: id }, { title: parsed.data.title }, { new: true });
            if (!lesson) {
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lesson not found' });
            }
            return reply.send({ message: 'Lesson updated successfully', lesson });
        });
        // Delete Lesson
        child.delete('/:id/lessons/:lessonId', async (request, reply) => {
            const { id, lessonId } = request.params;
            if (!require('mongoose').Types.ObjectId.isValid(lessonId)) {
                return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid lesson ID format' });
            }
            const lesson = await models_1.Lesson.findOne({ _id: lessonId, courseId: id });
            if (!lesson) {
                return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lesson not found' });
            }
            // Delete the physical file
            if (lesson.storagePath) {
                try {
                    const fullPath = path_1.default.resolve(process.cwd(), lesson.storagePath.replace(/^\//, ''));
                    if (require('fs').existsSync(fullPath)) {
                        require('fs').unlinkSync(fullPath);
                    }
                }
                catch (err) {
                    child.log.error(err, 'Failed to delete physical lesson file');
                }
            }
            await models_1.Lesson.deleteOne({ _id: lessonId });
            // Reorder remaining lessons
            const remainingLessons = await models_1.Lesson.find({ courseId: id }).sort({ orderIndex: 1 });
            const ops = remainingLessons.map((l, index) => ({
                updateOne: {
                    filter: { _id: l._id },
                    update: { $set: { orderIndex: index } }
                }
            }));
            if (ops.length > 0) {
                await models_1.Lesson.bulkWrite(ops);
            }
            return reply.send({ message: 'Lesson deleted successfully' });
        });
    });
}

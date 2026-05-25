"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = aiNotesRoutes;
const zod_1 = require("zod");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const ai_service_1 = require("../services/ai.service");
const pdf_lib_1 = require("pdf-lib");
async function aiNotesRoutes(fastify) {
    // ==========================================
    // 1. AI ASSISTANT ENDPOINTS
    // ==========================================
    // Request a summary for a lesson (asynchronously queued)
    fastify.post('/ai/summarise/:lessonId', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { lessonId } = request.params;
        const { userId } = request.user;
        const lesson = await models_1.Lesson.findById(lessonId);
        if (!lesson)
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lesson not found' });
        // Create an AI job
        const job = await models_1.AiJob.create({
            type: 'SUMMARY',
            refId: lessonId,
            userId,
            status: 'PROCESSING'
        });
        // Run AI processing in background
        (async () => {
            try {
                const prompt = `Summarise the lesson titled "${lesson.title}" which is a ${lesson.type}.`;
                const result = await (0, ai_service_1.callAIService)({
                    type: 'SUMMARY',
                    prompt,
                    systemInstruction: 'You are an AI learning assistant for RoboAIAPaths LMS. Provide a summary with chapters and formula definitions in Markdown format.'
                });
                job.status = 'DONE';
                job.result = result;
                await job.save();
                // Update lesson with transcript/summary directly if empty
                if (!lesson.transcript) {
                    lesson.transcript = result;
                    await lesson.save();
                }
            }
            catch (err) {
                job.status = 'FAILED';
                await job.save();
            }
        })();
        return reply.status(202).send({ message: 'Summary job queued successfully', jobId: job._id });
    });
    // RAG Q&A
    fastify.post('/ai/ask', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const schema = zod_1.z.object({
            courseId: zod_1.z.string(),
            question: zod_1.z.string().min(5),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const { courseId, question } = parsed.data;
        const course = await models_1.Course.findById(courseId);
        if (!course)
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Course not found' });
        // Run dynamic Q&A
        const prompt = `Course Context: Title "${course.title}". Description: "${course.description}".\nStudent Question: "${question}"`;
        const answer = await (0, ai_service_1.callAIService)({
            type: 'QA',
            prompt,
            systemInstruction: 'You are an expert tutor on RoboAIAPaths LMS. Answer questions concisely with clear formatting.'
        });
        // Log AI Job in DB
        await models_1.AiJob.create({
            type: 'QA',
            refId: courseId,
            userId: request.user.userId,
            inputText: question,
            result: answer,
            status: 'DONE'
        });
        return reply.send({ answer });
    });
    // Polish Notes
    fastify.post('/ai/polish-notes', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const schema = zod_1.z.object({
            noteId: zod_1.z.string().optional(),
            rawText: zod_1.z.string().min(5)
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const { rawText, noteId } = parsed.data;
        const prompt = `Format and polish these study notes into clean Markdown:\n\n${rawText}`;
        const polishedText = await (0, ai_service_1.callAIService)({
            type: 'NOTES_POLISH',
            prompt,
            systemInstruction: 'Optimize notes for clarity and readability using headers, highlights, and checkboxes.'
        });
        if (noteId) {
            await models_1.Note.findByIdAndUpdate(noteId, {
                content: polishedText,
                updatedAt: new Date()
            });
        }
        return reply.send({ polishedText });
    });
    // Mindmap Generation
    fastify.post('/ai/mindmap', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const schema = zod_1.z.object({
            topic: zod_1.z.string().min(3),
            noteId: zod_1.z.string().optional()
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const { topic, noteId } = parsed.data;
        const prompt = `Generate a JSON mindmap for the topic: "${topic}". Response must be pure JSON only.`;
        const mindmapStr = await (0, ai_service_1.callAIService)({
            type: 'MINDMAP',
            prompt,
            systemInstruction: 'You must return a valid JSON object matching the schema: { "name": "string", "children": [{ "name": "string", "children": [] }] }. Do not output any Markdown wrappers or backticks.'
        });
        try {
            const mindmapJson = JSON.parse(mindmapStr);
            if (noteId) {
                await models_1.Note.findByIdAndUpdate(noteId, {
                    mindmapJson,
                    updatedAt: new Date()
                });
            }
            return reply.send({ mindmap: mindmapJson });
        }
        catch (err) {
            // Return a basic template in case JSON parse failed
            const fallbackMindmap = {
                name: topic,
                children: [
                    { name: "Overview" },
                    { name: "Key Concepts" },
                    { name: "Core Formulas" }
                ]
            };
            return reply.send({ mindmap: fallbackMindmap });
        }
    });
    // Poll Job Status
    fastify.get('/ai/jobs/:id', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const job = await models_1.AiJob.findOne({ _id: id, userId: request.user.userId });
        if (!job) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Job not found' });
        }
        return reply.send({ job });
    });
    // ==========================================
    // 2. NOTES WORKSPACE ENDPOINTS
    // ==========================================
    // List all notes for current user
    fastify.get('/notes', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const notes = await models_1.Note.find({ userId: request.user.userId })
            .populate('courseId', 'title')
            .populate('lessonId', 'title type')
            .sort({ updatedAt: -1 });
        return reply.send({ notes });
    });
    // Get note detail
    fastify.get('/notes/:id', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const note = await models_1.Note.findOne({ _id: id, userId: request.user.userId })
            .populate('courseId', 'title')
            .populate('lessonId', 'title type');
        if (!note) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' });
        }
        return reply.send({ note });
    });
    // Create Note
    fastify.post('/notes', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const schema = zod_1.z.object({
            courseId: zod_1.z.string(),
            lessonId: zod_1.z.string(),
            title: zod_1.z.string().default('Untitled Note'),
            content: zod_1.z.any().optional(),
            mindmapJson: zod_1.z.any().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const note = await models_1.Note.create({
            ...parsed.data,
            userId: request.user.userId,
            updatedAt: new Date()
        });
        return reply.status(201).send({ message: 'Note created successfully', note });
    });
    // Update Note
    fastify.put('/notes/:id', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const schema = zod_1.z.object({
            title: zod_1.z.string().optional(),
            content: zod_1.z.any().optional(),
            mindmapJson: zod_1.z.any().optional()
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const note = await models_1.Note.findOneAndUpdate({ _id: id, userId: request.user.userId }, { ...parsed.data, updatedAt: new Date() }, { new: true });
        if (!note) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' });
        }
        return reply.send({ message: 'Note updated successfully', note });
    });
    // Delete Note
    fastify.delete('/notes/:id', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const note = await models_1.Note.findOneAndDelete({ _id: id, userId: request.user.userId });
        if (!note) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' });
        }
        return reply.send({ message: 'Note deleted successfully' });
    });
    // Export Notes (as PDF or Markdown)
    fastify.get('/notes/:id/export', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const { format } = request.query;
        const note = await models_1.Note.findOne({ _id: id, userId: request.user.userId })
            .populate('courseId', 'title')
            .populate('lessonId', 'title');
        if (!note) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' });
        }
        const noteTitle = note.title || 'Study Note';
        const courseTitle = note.courseId?.title || 'Course';
        const lessonTitle = note.lessonId?.title || 'Lesson';
        const contentText = typeof note.content === 'string'
            ? note.content
            : JSON.stringify(note.content, null, 2);
        if (format === 'pdf') {
            const pdfDoc = await pdf_lib_1.PDFDocument.create();
            const page = pdfDoc.addPage([600, 800]);
            const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
            page.drawText(noteTitle.toUpperCase(), { x: 50, y: 740, size: 20, font: boldFont, color: (0, pdf_lib_1.rgb)(0 / 255, 110 / 255, 255 / 255) });
            page.drawText(`Course: ${courseTitle}`, { x: 50, y: 700, size: 11, font: font });
            page.drawText(`Lesson: ${lessonTitle}`, { x: 50, y: 685, size: 11, font: font });
            page.drawText(`Last Updated: ${note.updatedAt.toLocaleDateString()}`, { x: 50, y: 670, size: 10, font: font });
            page.drawLine({
                start: { x: 50, y: 650 },
                end: { x: 550, y: 650 },
                thickness: 1,
                color: (0, pdf_lib_1.rgb)(226 / 255, 232 / 255, 240 / 255)
            });
            // Split text by lines
            const cleanContent = contentText.replace(/[#*`[\]\-]/g, '');
            const lines = cleanContent.split('\n');
            let currentY = 620;
            for (const line of lines) {
                if (currentY < 50)
                    break; // prevent overflowing page
                page.drawText(line.substring(0, 85), { x: 50, y: currentY, size: 10, font: font });
                currentY -= 15;
            }
            const pdfBytes = await pdfDoc.save();
            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `attachment; filename=note_${id}.pdf`);
            return reply.send(Buffer.from(pdfBytes));
        }
        // Default to markdown export
        const markdownContent = `# ${noteTitle}\n\n**Course:** ${courseTitle}\n**Lesson:** ${lessonTitle}\n**Date:** ${note.updatedAt.toLocaleDateString()}\n\n---\n\n${contentText}`;
        reply.header('Content-Type', 'text/markdown');
        reply.header('Content-Disposition', `attachment; filename=note_${id}.md`);
        return reply.send(markdownContent);
    });
    // ==========================================
    // 3. BOOKMARK ENDPOINTS
    // ==========================================
    // Create Bookmark
    fastify.post('/bookmarks', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const schema = zod_1.z.object({
            lessonId: zod_1.z.string(),
            timestampSecs: zod_1.z.number().min(0),
            note: zod_1.z.string().optional(),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const bookmark = await models_1.Bookmark.create({
            ...parsed.data,
            userId: request.user.userId,
        });
        return reply.status(201).send({ message: 'Bookmark created successfully', bookmark });
    });
    // List user's bookmarks
    fastify.get('/bookmarks', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const bookmarks = await models_1.Bookmark.find({ userId: request.user.userId })
            .populate('lessonId', 'title courseId')
            .sort({ createdAt: -1 });
        return reply.send({ bookmarks });
    });
    // Delete Bookmark
    fastify.delete('/bookmarks/:id', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        const bookmark = await models_1.Bookmark.findOneAndDelete({ _id: id, userId: request.user.userId });
        if (!bookmark) {
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Bookmark not found' });
        }
        return reply.send({ message: 'Bookmark deleted successfully' });
    });
    // ==========================================
    // 4. PROGRESS TRACKING ENDPOINTS
    // ==========================================
    // Update progress
    fastify.put('/progress/:lessonId', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { lessonId } = request.params;
        const schema = zod_1.z.object({
            watchedSecs: zod_1.z.number().min(0),
            totalSecs: zod_1.z.number().min(1),
            lastPosition: zod_1.z.number().min(0),
        });
        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
        }
        const lesson = await models_1.Lesson.findById(lessonId);
        if (!lesson)
            return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lesson not found' });
        const { watchedSecs, totalSecs, lastPosition } = parsed.data;
        const completed = watchedSecs >= totalSecs * 0.9; // Completed if 90% watched
        const progress = await models_1.Progress.findOneAndUpdate({ userId: request.user.userId, lessonId }, {
            courseId: lesson.courseId,
            watchedSecs,
            totalSecs,
            completed,
            lastPosition,
            updatedAt: new Date()
        }, { upsert: true, new: true });
        return reply.send({ message: 'Progress updated', progress });
    });
    // Get course progress summary
    fastify.get('/progress/:courseId', { preHandler: [auth_1.authenticate] }, async (request, reply) => {
        const { courseId } = request.params;
        const { userId } = request.user;
        // Find all lessons in this course
        const lessons = await models_1.Lesson.find({ courseId }, '_id title');
        const lessonIds = lessons.map(l => l._id);
        // Find progress documents for these lessons
        const progresses = await models_1.Progress.find({
            userId,
            lessonId: { $in: lessonIds }
        });
        const completedCount = progresses.filter(p => p.completed).length;
        const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
        return reply.send({
            progressPercent,
            completedLessons: progresses.filter(p => p.completed).map(p => p.lessonId),
            history: progresses
        });
    });
}

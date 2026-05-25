import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Bookmark, Lesson } from '../models';
import { authenticate } from '../middleware/auth';

export default async function bookmarkRoutes(fastify: FastifyInstance) {

  // Get all bookmarks for user
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { userId } = request.user!;

    // Populate lessonId to get courseId in the frontend
    const bookmarks = await Bookmark.find({ userId })
      .populate('lessonId', 'title type courseId')
      .sort({ createdAt: -1 });

    return reply.send({ bookmarks });
  });

  // Create a new bookmark
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { userId } = request.user!;

    const schema = z.object({
      lessonId: z.string(),
      timestampSecs: z.number(),
      note: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
    }

    const { lessonId, timestampSecs, note } = parsed.data;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lesson not found' });
    }

    const bookmark = await Bookmark.create({
      userId,
      lessonId,
      timestampSecs,
      note
    });

    return reply.status(201).send({ message: 'Bookmark created', bookmark });
  });

}

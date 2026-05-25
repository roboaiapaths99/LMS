import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Progress, Lesson } from '../models';
import { authenticate } from '../middleware/auth';

export default async function progressRoutes(fastify: FastifyInstance) {

  // Get completed lessons for a course
  fastify.get('/:courseId', { preHandler: [authenticate] }, async (request, reply) => {
    const { courseId } = request.params as any;
    const { userId } = request.user!;

    const progressRecords = await Progress.find({ userId, courseId, completed: true });
    const completedLessons = progressRecords.map(p => p.lessonId.toString());

    // Calculate progress percentage
    const totalLessons = await Lesson.countDocuments({ courseId });
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

    return reply.send({ completedLessons, progressPercent });
  });

  // Update progress for a lesson
  fastify.put('/:lessonId', { preHandler: [authenticate] }, async (request, reply) => {
    const { lessonId } = request.params as any;
    const { userId } = request.user!;

    const schema = z.object({
      watchedSecs: z.number(),
      totalSecs: z.number(),
      lastPosition: z.number(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
    }

    const { watchedSecs, totalSecs, lastPosition } = parsed.data;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lesson not found' });
    }

    // Mark completed if watched at least 90%
    const completed = totalSecs > 0 && watchedSecs >= (totalSecs * 0.9);

    let progress = await Progress.findOne({ userId, lessonId });

    if (progress) {
      // Only update if watched more, or update last position
      progress.watchedSecs = Math.max(progress.watchedSecs, watchedSecs);
      progress.totalSecs = totalSecs;
      progress.lastPosition = lastPosition;
      if (completed) progress.completed = true;
      progress.updatedAt = new Date();
      await progress.save();
    } else {
      progress = await Progress.create({
        userId,
        lessonId,
        courseId: lesson.courseId,
        watchedSecs,
        totalSecs,
        lastPosition,
        completed
      });
    }

    return reply.send({ message: 'Progress updated', progress });
  });

}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Bundle, Course, Coupon } from '../models';
import { authenticate, authorize } from '../middleware/auth';

export default async function bundleRoutes(fastify: FastifyInstance) {

  // Public/User: List bundles for a course
  fastify.get('/:courseId', { preHandler: [authenticate] }, async (request, reply) => {
    const { courseId } = request.params as any;
    
    if (!require('mongoose').Types.ObjectId.isValid(courseId)) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid course ID format' });
    }

    // Verify course exists and matches role visibility
    const course = await Course.findById(courseId);
    if (!course) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Course not found' });
    }

    const { role } = request.user!;
    if (role === 'STUDENT' && course.visibility === 'INSTRUCTOR') {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Students do not have access to this course bundles' });
    }
    if (role === 'INSTRUCTOR' && course.visibility === 'STUDENT') {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Instructors do not have access to this course bundles' });
    }

    let query: any = { courseId, isActive: true };

    if (role === 'INSTRUCTOR') {
      // Instructors can only see COMBO or PDF_ONLY
      query.type = { $in: ['COMBO', 'PDF_ONLY'] };
    } else if (role === 'STUDENT') {
      // Students can only see COMBO or VIDEO_ONLY
      query.type = { $in: ['COMBO', 'VIDEO_ONLY'] };
    }

    const bundles = await Bundle.find(query);
    return reply.send({ bundles });
  });

  // Admin/Instructor Routes
  fastify.register(async function bundleAdminRoutes(child) {
    child.addHook('preHandler', authenticate);
    child.addHook('preHandler', authorize(['ADMIN', 'INSTRUCTOR']));

    // Create Bundle
    child.post('/', async (request, reply) => {
      const schema = z.object({
        courseId: z.string(),
        name: z.string().min(3),
        type: z.enum(['VIDEO_ONLY', 'PDF_ONLY', 'COMBO']),
        priceInr: z.number().min(0),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const course = await Course.findById(parsed.data.courseId);
      if (!course) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Course not found' });
      }

      const bundle = await Bundle.create({
        ...parsed.data,
        isActive: true
      });

      return reply.status(201).send({ message: 'Bundle created successfully', bundle });
    });

    // Update Bundle
    child.put('/:id', async (request, reply) => {
      const { id } = request.params as any;
      if (!require('mongoose').Types.ObjectId.isValid(id)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid bundle ID format' });
      }
      const schema = z.object({
        name: z.string().min(3).optional(),
        type: z.enum(['VIDEO_ONLY', 'PDF_ONLY', 'COMBO']).optional(),
        priceInr: z.number().min(0).optional(),
        isActive: z.boolean().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const bundle = await Bundle.findByIdAndUpdate(id, parsed.data, { new: true });
      if (!bundle) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Bundle not found' });
      }

      return reply.send({ message: 'Bundle updated successfully', bundle });
    });

    // Deactivate Bundle (Soft Delete)
    child.delete('/:id', async (request, reply) => {
      const { id } = request.params as any;
      if (!require('mongoose').Types.ObjectId.isValid(id)) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid bundle ID format' });
      }
      const bundle = await Bundle.findByIdAndUpdate(id, { isActive: false }, { new: true });
      if (!bundle) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Bundle not found' });
      }
      return reply.send({ message: 'Bundle deactivated successfully', bundle });
    });
  });
}

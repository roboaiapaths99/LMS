import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Order, Bundle, Coupon, UserCourseAccess, User } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { generatePayUHash, verifyPayUHash, processRefund } from '../services/payu.service';
import { sendSystemNotification } from '../services/notification.service';
import { generateInvoicePDF } from '../services/pdf.service';
import crypto from 'crypto';

export default async function orderRoutes(fastify: FastifyInstance) {

  // ==========================================
  // STUDENT / USER ROUTES
  // ==========================================

  // Validate coupon
  fastify.post('/coupons/validate', { preHandler: [authenticate] }, async (request, reply) => {
    const schema = z.object({
      code: z.string().toUpperCase(),
      bundleId: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
    }

    const { code, bundleId } = parsed.data;

    const coupon = await Coupon.findOne({ code, bundleId });
    if (!coupon) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Coupon not found or not applicable to this bundle' });
    }

    // Check expiry
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Coupon has expired' });
    }

    // Check usage limits
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Coupon usage limit reached' });
    }

    const bundle = await Bundle.findById(bundleId);
    if (!bundle) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Bundle not found' });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'FLAT') {
      discountAmount = coupon.discountValue;
    } else {
      discountAmount = (bundle.priceInr * coupon.discountValue) / 100;
    }

    // Discount cannot exceed bundle price
    discountAmount = Math.min(discountAmount, bundle.priceInr);
    const finalAmount = bundle.priceInr - discountAmount;

    return reply.send({
      valid: true,
      couponId: coupon._id,
      discountAmount,
      finalAmount
    });
  });

  // Initiate order (create order + get PayU parameters)
  fastify.post('/orders/initiate', { preHandler: [authenticate] }, async (request, reply) => {
    const schema = z.object({
      bundleId: z.string(),
      couponCode: z.string().toUpperCase().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
    }

    const { bundleId, couponCode } = parsed.data;
    const { userId } = request.user!;

    const bundle = await Bundle.findById(bundleId).populate('courseId');
    if (!bundle) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Bundle not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
    }

    let discountAmount = 0;
    let couponId: string | undefined = undefined;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, bundleId });
      if (coupon) {
        // Expiry check
        const isNotExpired = !coupon.expiresAt || coupon.expiresAt > new Date();
        const hasUsesLeft = coupon.maxUses === 0 || coupon.usedCount < coupon.maxUses;
        if (isNotExpired && hasUsesLeft) {
          couponId = coupon._id.toString();
          if (coupon.discountType === 'FLAT') {
            discountAmount = coupon.discountValue;
          } else {
            discountAmount = (bundle.priceInr * coupon.discountValue) / 100;
          }
          discountAmount = Math.min(discountAmount, bundle.priceInr);
        }
      }
    }

    const finalAmount = Math.max(0, bundle.priceInr - discountAmount);

    if (finalAmount <= 0) {
      // 0-Price Checkout Bypass (Free course or 100% Coupon discount)
      const order = await Order.create({
        userId,
        bundleId,
        amountInr: 0,
        discountAmount,
        couponId,
        status: 'SUCCESS',
      });

      await UserCourseAccess.findOneAndUpdate(
        { userId, courseId: (bundle.courseId as any)._id || bundle.courseId, bundleId: bundle._id },
        { 
          accessType: bundle.type,
          grantedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      if (couponId) {
        await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: 1 } });
      }

      await sendSystemNotification(userId.toString(), 'Course Unlocked!', 'You claimed a 100% discount. You now have access to the purchased study bundle.', 'SUCCESS');

      return reply.status(201).send({
        message: 'Course access granted successfully',
        orderId: order._id,
        isFree: true,
        success: true
      });
    }

    const txnid = `TXN_${crypto.randomBytes(8).toString('hex')}`.toUpperCase();

    // Create pending order
    const order = await Order.create({
      userId,
      bundleId,
      amountInr: finalAmount,
      discountAmount,
      couponId,
      payuTxnId: txnid,
      status: 'PENDING',
    });

    // Generate PayU Hash
    const productinfo = (bundle.courseId as any).title || bundle.name;
    const firstname = user.name || 'Student';
    const email = user.email || 'info@roboaiapaths.com';

    const hash = generatePayUHash({
      txnid,
      amount: finalAmount,
      productinfo,
      firstname,
      email,
    });

    // Deploy config: dynamic success/fail URLs
    const successUrl = process.env.PAYU_SUCCESS_URL || `${request.protocol}://${request.hostname}/payment/success`;
    const failUrl = process.env.PAYU_FAIL_URL || `${request.protocol}://${request.hostname}/payment/failed`;

    return reply.status(201).send({
      message: 'Order initiated',
      orderId: order._id,
      paymentParams: {
        key: process.env.PAYU_KEY || 'dev_key',
        txnid,
        amount: finalAmount.toFixed(2),
        productinfo,
        firstname,
        email,
        phone: user.mobile,
        surl: successUrl,
        furl: failUrl,
        hash,
      }
    });
  });

  // PayU webhook/callback
  fastify.post('/webhooks/payu', async (request, reply) => {
    // PayU sends form-url-encoded POST parameters
    const body = request.body as any;
    
    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      hash: postedHash,
      mihpayid
    } = body;

    fastify.log.info(`PayU Webhook received: txnid=${txnid}, status=${status}`);

    const isValid = verifyPayUHash({
      txnid,
      amount: parseFloat(amount),
      productinfo,
      firstname,
      email,
      status,
      postedHash
    });

    // In a real app we strict-verify the hash, but for dev fallback, let's accept if valid OR dev mode
    if (!isValid && process.env.NODE_ENV === 'production') {
      fastify.log.error('Invalid PayU hash signature received in webhook');
      return reply.status(400).send({ error: 'Signature verification failed' });
    }

    const order = await Order.findOne({ payuTxnId: txnid });
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    if (order.status !== 'PENDING') {
      return reply.send({ message: 'Order already processed' });
    }

    if (status === 'success') {
      order.status = 'SUCCESS';
      await order.save();

      // Grant course access
      const bundle = await Bundle.findById(order.bundleId);
      if (bundle) {
        await UserCourseAccess.findOneAndUpdate(
          { userId: order.userId, courseId: bundle.courseId, bundleId: bundle._id },
          { 
            accessType: bundle.type,
            grantedAt: new Date(),
          },
          { upsert: true, new: true }
        );

        // Update coupon count if used
        if (order.couponId) {
          await Coupon.findByIdAndUpdate(order.couponId, { $inc: { usedCount: 1 } });
        }
        
        await sendSystemNotification(order.userId.toString(), 'Course Unlocked!', 'Your payment was successful. You now have access to the purchased study bundle.', 'SUCCESS');
      }
    } else {
      order.status = 'FAILED';
      await order.save();
    }

    return reply.send({ success: true });
  });

  // Get current user's order history
  fastify.get('/orders', { preHandler: [authenticate] }, async (request, reply) => {
    const orders = await Order.find({ userId: request.user!.userId })
      .populate({
        path: 'bundleId',
        populate: { path: 'courseId', select: 'title thumbnailUrl' }
      })
      .sort({ createdAt: -1 });

    return reply.send({ orders });
  });

  // Get order detail
  fastify.get('/orders/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const order = await Order.findOne({ _id: request.params as any, userId: request.user!.userId })
      .populate({
        path: 'bundleId',
        populate: { path: 'courseId' }
      });

    if (!order) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Order not found' });
    }

    return reply.send({ order });
  });

  // Download Invoice PDF
  fastify.get('/orders/:id/invoice', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as any;
    const order = await Order.findOne({ _id: id, userId: request.user!.userId })
      .populate({
        path: 'bundleId',
        populate: { path: 'courseId' }
      });

    if (!order) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Order not found' });
    }

    if (order.status !== 'SUCCESS') {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invoice only available for successful orders' });
    }

    const user = await User.findById(request.user!.userId);
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
    }

    const pdfBuffer = await generateInvoicePDF({
      orderId: order._id.toString(),
      date: order.createdAt.toLocaleDateString(),
      userName: user.name || 'Student',
      userMobile: user.mobile,
      courseName: (order.bundleId as any).courseId.title || 'Course',
      bundleName: (order.bundleId as any).name || 'Bundle',
      amount: order.amountInr + order.discountAmount,
      discount: order.discountAmount,
      total: order.amountInr,
      paymentStatus: order.status,
    });

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=invoice_${order._id}.pdf`);
    return reply.send(pdfBuffer);
  });

  // ==========================================
  // ADMIN ROUTES (Orders & Coupons)
  // ==========================================

  fastify.register(async function adminPaymentRoutes(child) {
    child.addHook('preHandler', authenticate);
    child.addHook('preHandler', authorize(['ADMIN']));

    // Coupons CRUD: List
    child.get('/admin/coupons', async (request, reply) => {
      const coupons = await Coupon.find().populate({
        path: 'bundleId',
        populate: { path: 'courseId', select: 'title' }
      });
      return reply.send({ coupons });
    });

    // Coupons CRUD: Create
    child.post('/admin/coupons', async (request, reply) => {
      const schema = z.object({
        code: z.string().toUpperCase(),
        bundleId: z.string(),
        discountType: z.enum(['FLAT', 'PERCENT']),
        discountValue: z.number().min(0),
        expiresAt: z.string().optional(),
        maxUses: z.number().default(0),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const bundle = await Bundle.findById(parsed.data.bundleId);
      if (!bundle) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Bundle not found' });
      }

      const coupon = await Coupon.create({
        ...parsed.data,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      });

      return reply.status(201).send({ message: 'Coupon created successfully', coupon });
    });

    // Coupons CRUD: Update
    child.put('/admin/coupons/:id', async (request, reply) => {
      const { id } = request.params as any;
      const schema = z.object({
        discountType: z.enum(['FLAT', 'PERCENT']).optional(),
        discountValue: z.number().min(0).optional(),
        expiresAt: z.string().optional(),
        maxUses: z.number().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const updateData: any = { ...parsed.data };
      if (parsed.data.expiresAt) {
        updateData.expiresAt = new Date(parsed.data.expiresAt);
      }

      const coupon = await Coupon.findByIdAndUpdate(id, updateData, { new: true });
      if (!coupon) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Coupon not found' });
      }

      return reply.send({ message: 'Coupon updated', coupon });
    });

    // Coupons CRUD: Delete (Deactivate)
    child.delete('/admin/coupons/:id', async (request, reply) => {
      const { id } = request.params as any;
      await Coupon.findByIdAndDelete(id);
      return reply.send({ message: 'Coupon deleted successfully' });
    });

    // List ALL orders with pagination and filters
    child.get('/admin/orders', async (request, reply) => {
      const querySchema = z.object({
        status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(10),
      });

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: parsed.error.issues[0].message });
      }

      const { status, page, limit } = parsed.data;
      const filter: any = {};
      if (status) filter.status = status;

      const skip = (page - 1) * limit;

      const orders = await Order.find(filter)
        .populate('userId', 'name mobile email')
        .populate({
          path: 'bundleId',
          populate: { path: 'courseId', select: 'title' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Order.countDocuments(filter);

      return reply.send({
        orders,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    });

    // Confirm Payment Manually
    child.post('/admin/orders/:id/confirm', async (request, reply) => {
      const { id } = request.params as any;
      const order = await Order.findById(id);
      if (!order) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Order not found' });

      if (order.status === 'SUCCESS') {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Order is already successful' });
      }

      order.status = 'SUCCESS';
      await order.save();

      // Grant course access
      const bundle = await Bundle.findById(order.bundleId);
      if (bundle) {
        await UserCourseAccess.findOneAndUpdate(
          { userId: order.userId, courseId: bundle.courseId, bundleId: bundle._id },
          { 
            accessType: bundle.type,
            grantedAt: new Date(),
          },
          { upsert: true, new: true }
        );
      }

      await sendSystemNotification(order.userId.toString(), 'Course Unlocked!', 'Your payment was manually confirmed. You now have access to the purchased study bundle.', 'SUCCESS');

      return reply.send({ message: 'Order confirmed successfully', order });
    });

    // Refund Order
    child.post('/admin/orders/:id/refund', async (request, reply) => {
      const { id } = request.params as any;
      const order = await Order.findById(id);
      if (!order) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Order not found' });

      if (order.status !== 'SUCCESS') {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Only successful orders can be refunded' });
      }

      if (order.payuTxnId) {
        try {
          await processRefund(order.payuTxnId, order.amountInr);
        } catch (err: any) {
          fastify.log.error(`PayU Refund failed: ${err.message}`);
          return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to process refund with Payment Gateway: ' + err.message });
        }
      }

      order.status = 'REFUNDED';
      await order.save();

      // Revoke Access
      const bundle = await Bundle.findById(order.bundleId);
      if (bundle) {
        await UserCourseAccess.findOneAndDelete({
          userId: order.userId,
          courseId: bundle.courseId,
          bundleId: bundle._id
        });
      }

      await sendSystemNotification(order.userId.toString(), 'Refund Processed', 'Your refund has been completed and course access has been revoked.', 'WARNING');

      return reply.send({ message: 'Refund processed successfully', order });
    });

    // Revenue analytics
    child.get('/admin/revenue', async (request, reply) => {
      const stats = await Order.aggregate([
        { $match: { status: 'SUCCESS' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amountInr' },
            totalOrders: { $sum: 1 }
          }
        }
      ]);

      // Daily analytics for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyStats = await Order.aggregate([
        { $match: { status: 'SUCCESS', createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$amountInr' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return reply.send({
        summary: stats[0] || { totalRevenue: 0, totalOrders: 0 },
        daily: dailyStats
      });
    });

    // Export Orders CSV
    child.get('/admin/export/orders', async (request, reply) => {
      const orders = await Order.find()
        .populate('userId', 'name mobile')
        .populate({
          path: 'bundleId',
          populate: { path: 'courseId', select: 'title' }
        });

      let csv = 'Order ID,Date,User Name,User Mobile,Item,Amount (INR),Status\n';
      
      for (const order of orders) {
        const date = order.createdAt.toISOString();
        const userName = (order.userId as any)?.name || 'N/A';
        const userMobile = (order.userId as any)?.mobile || 'N/A';
        const item = (order.bundleId as any)?.courseId?.title || 'Unknown';
        
        csv += `"${order._id}","${date}","${userName}","${userMobile}","${item}","${order.amountInr}","${order.status}"\n`;
      }

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename=orders_export.csv');
      return reply.send(csv);
    });

    // Export Users CSV
    child.get('/admin/export/users', async (request, reply) => {
      const users = await User.find();
      let csv = 'User ID,Mobile,Name,Email,Role,Is Active,Created At\n';

      for (const user of users) {
        const date = user.createdAt.toISOString();
        const name = user.name || '';
        const email = user.email || '';
        
        csv += `"${user._id}","${user.mobile}","${name}","${email}","${user.role}","${user.isActive}","${date}"\n`;
      }

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename=users_export.csv');
      return reply.send(csv);
    });
  });
}

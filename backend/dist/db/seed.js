"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
const mongodb_1 = require("./mongodb");
const pdf_lib_1 = require("pdf-lib");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function seed() {
    console.log('🌱 Starting RoboAIPaths Database Seeding...');
    // 1. Database Connection
    await (0, mongodb_1.connectDB)();
    try {
        // 2. Clear All Existing Collections
        console.log('🧹 Clearing old collections...');
        await Promise.all([
            models_1.User.deleteMany({}),
            models_1.Device.deleteMany({}),
            models_1.Course.deleteMany({}),
            models_1.Lesson.deleteMany({}),
            models_1.Bundle.deleteMany({}),
            models_1.Coupon.deleteMany({}),
            models_1.Order.deleteMany({}),
            models_1.UserCourseAccess.deleteMany({}),
            models_1.LiveSession.deleteMany({}),
        ]);
        console.log('✨ Database cleared!');
        // 3. Create Sample Local Files for Watermarking & Streaming
        const uploadsDir = path_1.default.resolve(process.cwd(), 'uploads');
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        console.log('📄 Generating valid sample PDF resource for watermarking...');
        const samplePdfPath = path_1.default.join(uploadsDir, 'sample_guide.pdf');
        const pdfDoc = await pdf_lib_1.PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
        page.drawText('ROBOAIAPATHS certified study guide', {
            x: 50,
            y: 700,
            size: 24,
            font,
            color: (0, pdf_lib_1.rgb)(0 / 255, 110 / 255, 255 / 255), // #006eff
        });
        page.drawText('This premium handout contains core equations and hardware blueprints.', {
            x: 50,
            y: 650,
            size: 12,
        });
        page.drawText('Watermark overlays are injected dynamically at local IST clock updates.', {
            x: 50,
            y: 630,
            size: 11,
        });
        const pdfBytes = await pdfDoc.save();
        fs_1.default.writeFileSync(samplePdfPath, pdfBytes);
        console.log(`✅ Sample PDF created at ${samplePdfPath}`);
        console.log('🎥 Creating sample video placeholder for classroom streaming...');
        const sampleVideoPath = path_1.default.join(uploadsDir, 'sample_lecture.mp4');
        // Write 100 bytes of dummy mp4 stream data
        fs_1.default.writeFileSync(sampleVideoPath, Buffer.alloc(100, 'MOCK_VIDEO_BINARY_STREAM'));
        console.log(`✅ Sample Video created at ${sampleVideoPath}`);
        // 4. Create Pre-Configured Users
        console.log('👤 Seeding premium roles...');
        // Admin
        const adminUser = await models_1.User.create({
            mobile: '9876543210',
            name: 'Admin Chief Officer',
            email: 'admin@roboaiapaths.com',
            role: 'ADMIN',
            isActive: true,
            otpAttempts: 0,
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        });
        // Instructor
        const instructorUser = await models_1.User.create({
            mobile: '9999999999',
            name: 'Dr. Elena Vance',
            email: 'elena.vance@roboaiapaths.com',
            role: 'INSTRUCTOR',
            isActive: true,
            otpAttempts: 0,
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
        });
        // Student
        const studentUser = await models_1.User.create({
            mobile: '8888888888',
            name: 'Bhaskar Joshi (Student)',
            email: 'bhaskar.joshi@roboaiapaths.com',
            role: 'STUDENT',
            isActive: true,
            otpAttempts: 0,
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
        });
        console.log('👥 Users seeded successfully!');
        // 5. Seed Device Bindings
        await models_1.Device.create({
            userId: studentUser._id,
            deviceId: 'DEV-SHIELD-MOCK-STUDENT-001',
            deviceName: 'Windows PC (Chrome)',
            status: 'ACTIVE',
            requestedAt: new Date(),
        });
        await models_1.Device.create({
            userId: instructorUser._id,
            deviceId: 'DEV-SHIELD-MOCK-INSTRUCTOR-001',
            deviceName: 'MacBook Pro (Safari)',
            status: 'ACTIVE',
            requestedAt: new Date(),
        });
        console.log('🔒 Device Shield bindings active!');
        // 6. Seed Course Pathways
        console.log('📚 Seeding certified course pathways...');
        const course1 = await models_1.Course.create({
            title: 'Industrial Robot Kinematics & Closed-Loop Control',
            description: 'Master spatial transformations, forward/inverse kinematics, and closed-loop feedback design. Combined with mathematical modeling and live lab calibrations.',
            category: 'Robotics',
            thumbnailUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=600',
            visibility: 'BOTH',
            status: 'PUBLISHED',
            createdBy: instructorUser._id,
        });
        const course2 = await models_1.Course.create({
            title: 'Edge AI & Real-Time Computer Vision Systems',
            description: 'Build low-latency object detection pipelines. Deploy YOLO kernels directly to edge single-board computers like Jetson Nano and Raspberry Pi.',
            category: 'Artificial Intelligence',
            thumbnailUrl: 'https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&q=80&w=600',
            visibility: 'STUDENT',
            status: 'PUBLISHED',
            createdBy: instructorUser._id,
        });
        const course3 = await models_1.Course.create({
            title: 'Advanced Drone Dynamics & Autonomous Navigation',
            description: 'Deep dive into aerospace physics, PID tuning for multicopters, and autonomous spatial pathfinding using high-fidelity heuristic planners.',
            category: 'Aerospace',
            thumbnailUrl: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&q=80&w=600',
            visibility: 'BOTH',
            status: 'PUBLISHED',
            createdBy: instructorUser._id,
        });
        // 7. Seed Lessons for Each Course
        console.log('📖 Seeding course lectures & watermarked material...');
        // Course 1 Lessons
        const lesson1_1 = await models_1.Lesson.create({
            courseId: course1._id,
            title: 'Introduction to Spatial Feedback Controllers',
            type: 'VIDEO',
            storagePath: 'uploads/sample_lecture.mp4',
            durationSecs: 640,
            orderIndex: 1,
            isFreePreview: true,
            transcript: 'Welcome to Lecture 1. In this session we discuss closed loop feedback, sensory encoders, and motor output adjustments. Make sure to review calculations on page 3 of the handout.',
        });
        const lesson1_2 = await models_1.Lesson.create({
            courseId: course1._id,
            title: 'Certified PID Balancing Blueprint Handout',
            type: 'PDF',
            storagePath: 'uploads/sample_guide.pdf',
            durationSecs: 0,
            orderIndex: 2,
            isFreePreview: false,
        });
        // Course 2 Lessons
        const lesson2_1 = await models_1.Lesson.create({
            courseId: course2._id,
            title: 'Deep Edge Acceleration & TensorRT compilation',
            type: 'VIDEO',
            storagePath: 'uploads/sample_lecture.mp4',
            durationSecs: 920,
            orderIndex: 1,
            isFreePreview: false,
            transcript: 'Today we discuss edge AI compilation pipeline, exporting ONNX weights, and setting up native INT8 calibrations for local tensor accelerators.',
        });
        const lesson2_2 = await models_1.Lesson.create({
            courseId: course2._id,
            title: 'YOLO Edge Detection Handout & Weights Guide',
            type: 'PDF',
            storagePath: 'uploads/sample_guide.pdf',
            durationSecs: 0,
            orderIndex: 2,
            isFreePreview: false,
        });
        // Course 3 Lessons
        const lesson3_1 = await models_1.Lesson.create({
            courseId: course3._id,
            title: 'Multicopter Dynamics & A* Path Planning heuristics',
            type: 'VIDEO',
            storagePath: 'uploads/sample_lecture.mp4',
            durationSecs: 780,
            orderIndex: 1,
            isFreePreview: true,
            transcript: 'This lesson covers flight mechanics, multi-rotor thrust vectors, and programming an A* search planner inside simulated physical coordinate matrices.',
        });
        const lesson3_2 = await models_1.Lesson.create({
            courseId: course3._id,
            title: 'Aerial Physics Formulation Cheat Sheet',
            type: 'PDF',
            storagePath: 'uploads/sample_guide.pdf',
            durationSecs: 0,
            orderIndex: 2,
            isFreePreview: false,
        });
        // 8. Seed Course Bundles
        console.log('💰 Seeding bundle packs (with strict rules)...');
        // Course 1 Bundles
        const c1_video = await models_1.Bundle.create({
            courseId: course1._id,
            name: 'Video Master Pack',
            type: 'VIDEO_ONLY',
            priceInr: 2499,
            isActive: true,
        });
        const c1_pdf = await models_1.Bundle.create({
            courseId: course1._id,
            name: 'Syllabus Study Guide',
            type: 'PDF_ONLY',
            priceInr: 999,
            isActive: true,
        });
        const c1_combo = await models_1.Bundle.create({
            courseId: course1._id,
            name: 'Enterprise COMBO Kit',
            type: 'COMBO',
            priceInr: 2999,
            isActive: true,
        });
        // Course 2 Bundles (Hides VIDEO_ONLY for study comparison)
        const c2_pdf = await models_1.Bundle.create({
            courseId: course2._id,
            name: 'Vision Study Guide',
            type: 'PDF_ONLY',
            priceInr: 1499,
            isActive: true,
        });
        const c2_combo = await models_1.Bundle.create({
            courseId: course2._id,
            name: 'Edge AI COMBO Suite',
            type: 'COMBO',
            priceInr: 4999,
            isActive: true,
        });
        // Course 3 Bundles
        const c3_video = await models_1.Bundle.create({
            courseId: course3._id,
            name: 'Drone Dynamics Videos',
            type: 'VIDEO_ONLY',
            priceInr: 2999,
            isActive: true,
        });
        const c3_combo = await models_1.Bundle.create({
            courseId: course3._id,
            name: 'Aerial Robotics COMBO Kit',
            type: 'COMBO',
            priceInr: 3999,
            isActive: true,
        });
        // 9. Seed Promotion Coupons
        console.log('🎟️ Seeding promo coupons...');
        await models_1.Coupon.create({
            code: 'LAUNCH20',
            bundleId: c1_combo._id,
            discountType: 'PERCENT',
            discountValue: 20,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            maxUses: 100,
            usedCount: 0,
        });
        await models_1.Coupon.create({
            code: 'ROBOMASTER',
            bundleId: c2_combo._id,
            discountType: 'FLAT',
            discountValue: 1000,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            maxUses: 50,
            usedCount: 0,
        });
        // 10. Seed Student Course Access
        // Give student access to Course 1 immediately for demonstration
        await models_1.UserCourseAccess.create({
            userId: studentUser._id,
            courseId: course1._id,
            bundleId: c1_combo._id,
            accessType: 'COMBO',
            grantedAt: new Date(),
        });
        console.log('🔓 Course access granted for Student Bhaskar Joshi!');
        // 11. Seed Live Webinar Sessions
        console.log('📡 Seeding upcoming & active webinar sessions...');
        // Live session starting now
        const now = new Date();
        await models_1.LiveSession.create({
            courseId: course1._id,
            instructorId: instructorUser._id,
            title: 'Dr. Elena Vance: Real-Time PID Calibration Seminar',
            description: 'Interactive session exploring how sensory delay affects PID loop constants. Toggle camera feed and participate in WebSocket chat calibration questions.',
            status: 'LIVE',
            type: 'OPEN',
            scheduledAt: now.toISOString(),
        });
        // Scheduled session tomorrow
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await models_1.LiveSession.create({
            courseId: course2._id,
            instructorId: instructorUser._id,
            title: 'Dr. Elena Vance: Edge Vision Calibration Workshop',
            description: 'Private invite-only webinar demonstrating live ONNX deployment to board interfaces.',
            status: 'SCHEDULED',
            type: 'INVITE',
            inviteToken: 'vance-edge-vision-token-2026',
            scheduledAt: tomorrow.toISOString(),
        });
        console.log('🎉 RoboAIPaths LMS Database Seed Completed Successfully!');
    }
    catch (error) {
        console.error('❌ Seeding Failed:', error);
    }
    finally {
        await (0, mongodb_1.disconnectDB)();
    }
}
seed();

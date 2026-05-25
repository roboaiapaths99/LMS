"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Progress = exports.Bookmark = exports.Notification = exports.AuditLog = exports.AiJob = exports.Note = exports.SessionChatMessage = exports.LiveSession = exports.UserCourseAccess = exports.Order = exports.Coupon = exports.Bundle = exports.Lesson = exports.Course = exports.Device = exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    mobile: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    email: { type: String },
    role: { type: String, enum: ['ADMIN', 'INSTRUCTOR', 'STUDENT'], default: 'STUDENT', required: true },
    isActive: { type: Boolean, default: true, required: true },
    otpAttempts: { type: Number, default: 0, required: true },
    avatarUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
    deletedAt: { type: Date }
});
exports.User = mongoose_1.default.model('User', UserSchema);
const DeviceSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    deviceName: { type: String },
    status: { type: String, enum: ['ACTIVE', 'PENDING', 'REJECTED'], default: 'ACTIVE', required: true },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String }
});
// Compound index to ensure uniqueness of user+device binding
DeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
exports.Device = mongoose_1.default.model('Device', DeviceSchema);
const CourseSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    thumbnailUrl: { type: String },
    visibility: { type: String, enum: ['STUDENT', 'INSTRUCTOR', 'BOTH'], default: 'STUDENT', required: true },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', required: true },
    isFeatured: { type: Boolean, default: false },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    deletedAt: { type: Date }
});
exports.Course = mongoose_1.default.model('Course', CourseSchema);
const LessonSchema = new mongoose_1.Schema({
    courseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['VIDEO', 'PDF'], required: true },
    storagePath: { type: String, required: true },
    durationSecs: { type: Number, default: 0 },
    orderIndex: { type: Number, default: 0 },
    isFreePreview: { type: Boolean, default: false },
    transcript: { type: String },
    createdAt: { type: Date, default: Date.now }
});
exports.Lesson = mongoose_1.default.model('Lesson', LessonSchema);
const BundleSchema = new mongoose_1.Schema({
    courseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['VIDEO_ONLY', 'PDF_ONLY', 'COMBO'], required: true },
    priceInr: { type: Number, required: true },
    isActive: { type: Boolean, default: true, required: true },
    createdAt: { type: Date, default: Date.now }
});
exports.Bundle = mongoose_1.default.model('Bundle', BundleSchema);
const CouponSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    bundleId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Bundle', required: true },
    discountType: { type: String, enum: ['FLAT', 'PERCENT'], required: true },
    discountValue: { type: Number, required: true },
    expiresAt: { type: Date },
    maxUses: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 }
});
exports.Coupon = mongoose_1.default.model('Coupon', CouponSchema);
const OrderSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bundleId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Bundle', required: true },
    amountInr: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    couponId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Coupon' },
    payuTxnId: { type: String },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'], default: 'PENDING', required: true },
    createdAt: { type: Date, default: Date.now }
});
exports.Order = mongoose_1.default.model('Order', OrderSchema);
const UserCourseAccessSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    bundleId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Bundle', required: true },
    accessType: { type: String, enum: ['VIDEO_ONLY', 'PDF_ONLY', 'COMBO'], required: true },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }
});
// Ensure uniqueness of access per user/course/bundle
UserCourseAccessSchema.index({ userId: 1, courseId: 1, bundleId: 1 }, { unique: true });
exports.UserCourseAccess = mongoose_1.default.model('UserCourseAccess', UserCourseAccessSchema);
const LiveSessionSchema = new mongoose_1.Schema({
    instructorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['INVITE', 'OPEN'], default: 'OPEN', required: true },
    inviteToken: { type: String },
    status: { type: String, enum: ['SCHEDULED', 'LIVE', 'ENDED'], default: 'SCHEDULED', required: true },
    scheduledAt: { type: Date, required: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
    recordingUrl: { type: String },
    aiSummary: { type: String }
});
exports.LiveSession = mongoose_1.default.model('LiveSession', LiveSessionSchema);
const SessionChatMessageSchema = new mongoose_1.Schema({
    sessionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'LiveSession', required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    sentAt: { type: Date, default: Date.now }
});
exports.SessionChatMessage = mongoose_1.default.model('SessionChatMessage', SessionChatMessageSchema);
const NoteSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Course', required: true },
    lessonId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    title: { type: String },
    content: { type: mongoose_1.Schema.Types.Mixed },
    mindmapJson: { type: mongoose_1.Schema.Types.Mixed },
    updatedAt: { type: Date, default: Date.now }
});
exports.Note = mongoose_1.default.model('Note', NoteSchema);
const AiJobSchema = new mongoose_1.Schema({
    type: { type: String, enum: ['SUMMARY', 'MINDMAP', 'NOTES_POLISH', 'QA'], required: true },
    refId: { type: String, required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    inputText: { type: String },
    status: { type: String, enum: ['QUEUED', 'PROCESSING', 'DONE', 'FAILED'], default: 'QUEUED', required: true },
    result: { type: String },
    createdAt: { type: Date, default: Date.now }
});
exports.AiJob = mongoose_1.default.model('AiJob', AiJobSchema);
const AuditLogSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    details: { type: mongoose_1.Schema.Types.Mixed },
    ipAddress: { type: String },
    createdAt: { type: Date, default: Date.now }
});
exports.AuditLog = mongoose_1.default.model('AuditLog', AuditLogSchema);
const NotificationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'INFO', required: true },
    isRead: { type: Boolean, default: false, required: true },
    createdAt: { type: Date, default: Date.now }
});
exports.Notification = mongoose_1.default.model('Notification', NotificationSchema);
const BookmarkSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lessonId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    timestampSecs: { type: Number, required: true },
    note: { type: String },
    createdAt: { type: Date, default: Date.now }
});
exports.Bookmark = mongoose_1.default.model('Bookmark', BookmarkSchema);
const ProgressSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lessonId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    courseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    watchedSecs: { type: Number, default: 0, required: true },
    totalSecs: { type: Number, default: 0, required: true },
    completed: { type: Boolean, default: false, required: true },
    lastPosition: { type: Number, default: 0, required: true },
    updatedAt: { type: Date, default: Date.now }
});
// Ensure uniqueness of progress record per user/lesson
ProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
exports.Progress = mongoose_1.default.model('Progress', ProgressSchema);

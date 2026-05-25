import mongoose, { Schema, Document, Types } from 'mongoose';

// ==========================================
// 1. USER MODEL
// ==========================================
export interface IUser extends Document {
  mobile: string;
  name?: string;
  email?: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  isActive: boolean;
  otpAttempts: number;
  avatarUrl?: string;
  createdAt: Date;
  deletedAt?: Date;
}

const UserSchema = new Schema<IUser>({
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

export const User = mongoose.model<IUser>('User', UserSchema);

// ==========================================
// 2. DEVICE MODEL
// ==========================================
export interface IDevice extends Document {
  userId: Types.ObjectId;
  deviceId: string;
  deviceName?: string;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectionReason?: string;
}

const DeviceSchema = new Schema<IDevice>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  deviceName: { type: String },
  status: { type: String, enum: ['ACTIVE', 'PENDING', 'REJECTED'], default: 'ACTIVE', required: true },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String }
});

// Compound index to ensure uniqueness of user+device binding
DeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);

// ==========================================
// 3. COURSE MODEL
// ==========================================
export interface ICourse extends Document {
  title: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  visibility: 'STUDENT' | 'INSTRUCTOR' | 'BOTH';
  status: 'DRAFT' | 'PUBLISHED';
  isFeatured?: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  deletedAt?: Date;
}

const CourseSchema = new Schema<ICourse>({
  title: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  thumbnailUrl: { type: String },
  visibility: { type: String, enum: ['STUDENT', 'INSTRUCTOR', 'BOTH'], default: 'STUDENT', required: true },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', required: true },
  isFeatured: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date }
});

export const Course = mongoose.model<ICourse>('Course', CourseSchema);

// ==========================================
// 4. LESSON MODEL
// ==========================================
export interface ILesson extends Document {
  courseId: Types.ObjectId;
  title: string;
  type: 'VIDEO' | 'PDF';
  storagePath: string; // local directory or Cloudflare R2 path
  durationSecs: number;
  orderIndex: number;
  isFreePreview: boolean;
  transcript?: string;
  createdAt: Date;
}

const LessonSchema = new Schema<ILesson>({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['VIDEO', 'PDF'], required: true },
  storagePath: { type: String, required: true },
  durationSecs: { type: Number, default: 0 },
  orderIndex: { type: Number, default: 0 },
  isFreePreview: { type: Boolean, default: false },
  transcript: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const Lesson = mongoose.model<ILesson>('Lesson', LessonSchema);

// ==========================================
// 5. BUNDLE MODEL
// ==========================================
export interface IBundle extends Document {
  courseId: Types.ObjectId;
  name: string;
  type: 'VIDEO_ONLY' | 'PDF_ONLY' | 'COMBO';
  priceInr: number;
  isActive: boolean;
  createdAt: Date;
}

const BundleSchema = new Schema<IBundle>({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['VIDEO_ONLY', 'PDF_ONLY', 'COMBO'], required: true },
  priceInr: { type: Number, required: true },
  isActive: { type: Boolean, default: true, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Bundle = mongoose.model<IBundle>('Bundle', BundleSchema);

// ==========================================
// 6. COUPON MODEL
// ==========================================
export interface ICoupon extends Document {
  code: string;
  bundleId: Types.ObjectId;
  discountType: 'FLAT' | 'PERCENT';
  discountValue: number;
  expiresAt?: Date;
  maxUses: number;
  usedCount: number;
}

const CouponSchema = new Schema<ICoupon>({
  code: { type: String, required: true, unique: true, uppercase: true, index: true },
  bundleId: { type: Schema.Types.ObjectId, ref: 'Bundle', required: true },
  discountType: { type: String, enum: ['FLAT', 'PERCENT'], required: true },
  discountValue: { type: Number, required: true },
  expiresAt: { type: Date },
  maxUses: { type: Number, default: 0 },
  usedCount: { type: Number, default: 0 }
});

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);

// ==========================================
// 7. ORDER MODEL
// ==========================================
export interface IOrder extends Document {
  userId: Types.ObjectId;
  bundleId: Types.ObjectId;
  amountInr: number;
  discountAmount: number;
  couponId?: Types.ObjectId;
  payuTxnId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  createdAt: Date;
}

const OrderSchema = new Schema<IOrder>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bundleId: { type: Schema.Types.ObjectId, ref: 'Bundle', required: true },
  amountInr: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
  payuTxnId: { type: String },
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'], default: 'PENDING', required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Order = mongoose.model<IOrder>('Order', OrderSchema);

// ==========================================
// 8. USER COURSE ACCESS MODEL
// ==========================================
export interface IUserCourseAccess extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  bundleId: Types.ObjectId;
  accessType: 'VIDEO_ONLY' | 'PDF_ONLY' | 'COMBO';
  grantedAt: Date;
  expiresAt?: Date;
}

const UserCourseAccessSchema = new Schema<IUserCourseAccess>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  bundleId: { type: Schema.Types.ObjectId, ref: 'Bundle', required: true },
  accessType: { type: String, enum: ['VIDEO_ONLY', 'PDF_ONLY', 'COMBO'], required: true },
  grantedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

// Ensure uniqueness of access per user/course/bundle
UserCourseAccessSchema.index({ userId: 1, courseId: 1, bundleId: 1 }, { unique: true });

export const UserCourseAccess = mongoose.model<IUserCourseAccess>('UserCourseAccess', UserCourseAccessSchema);

// ==========================================
// 9. LIVE SESSION MODEL
// ==========================================
export interface ILiveSession extends Document {
  instructorId: Types.ObjectId;
  courseId: Types.ObjectId;
  title: string;
  description?: string;
  type: 'INVITE' | 'OPEN';
  inviteToken?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  recordingUrl?: string;
  aiSummary?: string;
}

const LiveSessionSchema = new Schema<ILiveSession>({
  instructorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
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

export const LiveSession = mongoose.model<ILiveSession>('LiveSession', LiveSessionSchema);

// ==========================================
// 10. SESSION CHAT MESSAGE MODEL
// ==========================================
export interface ISessionChatMessage extends Document {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  message: string;
  sentAt: Date;
}

const SessionChatMessageSchema = new Schema<ISessionChatMessage>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'LiveSession', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now }
});

export const SessionChatMessage = mongoose.model<ISessionChatMessage>('SessionChatMessage', SessionChatMessageSchema);

// ==========================================
// 11. NOTE MODEL
// ==========================================
export interface INote extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  lessonId: Types.ObjectId;
  title?: string;
  content?: Schema.Types.Mixed; // Tiptap JSON or Markdown
  mindmapJson?: Schema.Types.Mixed; // Mindmap D3 format
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
  title: { type: String },
  content: { type: Schema.Types.Mixed },
  mindmapJson: { type: Schema.Types.Mixed },
  updatedAt: { type: Date, default: Date.now }
});

export const Note = mongoose.model<INote>('Note', NoteSchema);

// ==========================================
// 12. AI JOB MODEL
// ==========================================
export interface IAiJob extends Document {
  type: 'SUMMARY' | 'MINDMAP' | 'NOTES_POLISH' | 'QA';
  refId: string; // Mapped reference (e.g. lessonId, noteId)
  userId: Types.ObjectId;
  inputText?: string;
  status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  result?: string;
  createdAt: Date;
}

const AiJobSchema = new Schema<IAiJob>({
  type: { type: String, enum: ['SUMMARY', 'MINDMAP', 'NOTES_POLISH', 'QA'], required: true },
  refId: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  inputText: { type: String },
  status: { type: String, enum: ['QUEUED', 'PROCESSING', 'DONE', 'FAILED'], default: 'QUEUED', required: true },
  result: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const AiJob = mongoose.model<IAiJob>('AiJob', AiJobSchema);

// ==========================================
// 13. AUDIT LOG MODEL
// ==========================================
export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  action: string;
  entityType: string;
  entityId: string;
  details?: Schema.Types.Mixed;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  details: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

// ==========================================
// 14. NOTIFICATION MODEL
// ==========================================
export interface INotification extends Document {
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'INFO', required: true },
  isRead: { type: Boolean, default: false, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

// ==========================================
// 15. BOOKMARK MODEL
// ==========================================
export interface IBookmark extends Document {
  userId: Types.ObjectId;
  lessonId: Types.ObjectId;
  timestampSecs: number;
  note?: string;
  createdAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
  timestampSecs: { type: Number, required: true },
  note: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const Bookmark = mongoose.model<IBookmark>('Bookmark', BookmarkSchema);

// ==========================================
// 16. PROGRESS MODEL
// ==========================================
export interface IProgress extends Document {
  userId: Types.ObjectId;
  lessonId: Types.ObjectId;
  courseId: Types.ObjectId;
  watchedSecs: number;
  totalSecs: number;
  completed: boolean;
  lastPosition: number;
  updatedAt: Date;
}

const ProgressSchema = new Schema<IProgress>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  watchedSecs: { type: Number, default: 0, required: true },
  totalSecs: { type: Number, default: 0, required: true },
  completed: { type: Boolean, default: false, required: true },
  lastPosition: { type: Number, default: 0, required: true },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure uniqueness of progress record per user/lesson
ProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

export const Progress = mongoose.model<IProgress>('Progress', ProgressSchema);

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
// Load env vars from the root directory or local backend directory
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../.env') });
dotenv_1.default.config(); // fallback to current working directory
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(4000),
    MONGODB_URL: zod_1.z.string().min(1, "MONGODB_URL is required"),
    MONGODB_DB_NAME: zod_1.z.string().default("roboaiapaths_lms"),
    REDIS_URL: zod_1.z.string().default("redis://localhost:6379"),
    JWT_SECRET: zod_1.z.string().min(1, "JWT_SECRET is required"),
    JWT_REFRESH_SECRET: zod_1.z.string().min(1, "JWT_REFRESH_SECRET is required"),
    SMSMETA_KEY: zod_1.z.string().default("dev_key"),
    PAYU_KEY: zod_1.z.string().default("dev_key"),
    PAYU_SALT: zod_1.z.string().default("dev_salt"),
    PAYU_ENV: zod_1.z.string().default("development"),
    PAYU_SUCCESS_URL: zod_1.z.string().optional(),
    PAYU_FAIL_URL: zod_1.z.string().optional(),
    METAREACH_API_KEY: zod_1.z.string().optional(),
    METAREACH_SENDER_ID: zod_1.z.string().optional(),
    METAREACH_TEMPLATE_ID: zod_1.z.string().optional(),
    METAREACH_API_URL: zod_1.z.string().default("https://api.metareach.com/v2/send"),
    R2_BUCKET: zod_1.z.string().default("dev_bucket"),
    R2_ACCESS_KEY: zod_1.z.string().default("dev_access"),
    R2_SECRET_KEY: zod_1.z.string().default("dev_secret"),
    // Support Claude, OpenAI, and Gemini
    CLAUDE_API_KEY: zod_1.z.string().optional(),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    GEMINI_API_KEY: zod_1.z.string().optional(),
    AI_API_KEY: zod_1.z.string().optional(), // general fallback key
    // LiveKit
    LIVEKIT_API_KEY: zod_1.z.string().optional(),
    LIVEKIT_API_SECRET: zod_1.z.string().optional(),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    // Local storage paths
    UPLOAD_DIR: zod_1.z.string().default('uploads'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("❌ Invalid environment configuration:", parsed.error.format());
    process.exit(1);
}
exports.env = parsed.data;

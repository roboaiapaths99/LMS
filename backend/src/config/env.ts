import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load env vars from the root directory or local backend directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config(); // fallback to current working directory

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),
  MONGODB_DB_NAME: z.string().default("roboaiapaths_lms"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  SMSMETA_KEY: z.string().default("dev_key"),
  PAYU_KEY: z.string().default("dev_key"),
  PAYU_SALT: z.string().default("dev_salt"),
  PAYU_ENV: z.string().default("development"),
  PAYU_SUCCESS_URL: z.string().optional(),
  PAYU_FAIL_URL: z.string().optional(),
  METAREACH_API_KEY: z.string().optional(),
  METAREACH_SENDER_ID: z.string().optional(),
  METAREACH_TEMPLATE_ID: z.string().optional(),
  METAREACH_API_URL: z.string().default("https://api.metareach.com/v2/send"),
  R2_BUCKET: z.string().default("dev_bucket"),
  R2_ACCESS_KEY: z.string().default("dev_access"),
  R2_SECRET_KEY: z.string().default("dev_secret"),
  // Support Claude, OpenAI, and Gemini
  CLAUDE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(), // general fallback key
  // LiveKit
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Local storage paths
  UPLOAD_DIR: z.string().default('uploads'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { env } from '../config/env';

// Ensure upload directory exists
const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export async function saveLocalFile(fileStream: NodeJS.ReadableStream, filename: string, folder: string): Promise<string> {
  const targetDir = path.join(uploadDir, folder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, filename);
  await pipeline(fileStream, fs.createWriteStream(filePath));
  
  // Return a relative URL path that can be served
  return `/uploads/${folder}/${filename}`;
}

// In production, we would add functions here to upload to Cloudflare R2 using @aws-sdk/client-s3
// export async function saveToR2(...) { ... }

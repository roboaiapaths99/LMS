"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveLocalFile = saveLocalFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("stream/promises");
const env_1 = require("../config/env");
// Ensure upload directory exists
const uploadDir = path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR || 'uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
async function saveLocalFile(fileStream, filename, folder) {
    const targetDir = path_1.default.join(uploadDir, folder);
    if (!fs_1.default.existsSync(targetDir)) {
        fs_1.default.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path_1.default.join(targetDir, filename);
    await (0, promises_1.pipeline)(fileStream, fs_1.default.createWriteStream(filePath));
    // Return a relative URL path that can be served
    return `/uploads/${folder}/${filename}`;
}
// In production, we would add functions here to upload to Cloudflare R2 using @aws-sdk/client-s3
// export async function saveToR2(...) { ... }

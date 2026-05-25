"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
async function connectDB() {
    try {
        const conn = await mongoose_1.default.connect(env_1.env.MONGODB_URL, {
            dbName: env_1.env.MONGODB_DB_NAME,
        });
        console.log(`📡 MongoDB Connected: ${conn.connection.host}`);
        return conn;
    }
    catch (error) {
        console.error(`❌ MongoDB connection error:`, error);
        process.exit(1);
    }
}
async function disconnectDB() {
    await mongoose_1.default.disconnect();
}

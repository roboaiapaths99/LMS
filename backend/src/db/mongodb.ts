import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(env.MONGODB_URL, {
      dbName: env.MONGODB_DB_NAME,
    });
    console.log(`📡 MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error:`, error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

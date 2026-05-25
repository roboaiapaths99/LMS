import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import crypto from 'crypto';

export interface JwtPayload {
  userId: string;
  role: string;
  deviceId?: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

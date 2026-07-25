import { Document, Types } from "mongoose";

export interface IBlockedIp extends Document {
  ip: string;
  reason: string;
  blockedBy: string; // 'admin' | 'system'
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISecurityLog extends Document {
  ip: string;
  endpoint: string;
  method: string;
  userAgent?: string;
  reason: string;
  userId?: Types.ObjectId | string | null;
  createdAt: Date;
}

import mongoose, { Schema, Model } from "mongoose";
import { IBlockedIp, ISecurityLog } from "./security.interface";

const blockedIpSchema = new Schema<IBlockedIp>(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    blockedBy: {
      type: String,
      enum: ["admin", "system"],
      default: "system",
    },
    expiresAt: {
      type: Date,
      default: null, // null means permanent block
    },
  },
  {
    timestamps: true,
  },
);

blockedIpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

const securityLogSchema = new Schema<ISecurityLog>(
  {
    ip: {
      type: String,
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: "",
    },
    reason: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resetStrike: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

securityLogSchema.index({ createdAt: -1 });
securityLogSchema.index({ ip: 1, createdAt: -1 });

export const blockedIpModel: Model<IBlockedIp> = mongoose.model<IBlockedIp>(
  "BlockedIp",
  blockedIpSchema,
);

export const securityLogModel: Model<ISecurityLog> = mongoose.model<ISecurityLog>(
  "SecurityLog",
  securityLogSchema,
);

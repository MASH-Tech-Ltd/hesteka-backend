import { Schema, model } from "mongoose";
import { IDeviceReferral } from "./deviceReferral.interface";

const deviceReferralSchema = new Schema<IDeviceReferral>({
  ip: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  referralCode: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7200, // 2 hours TTL
  },
});

// Index for faster lookups
deviceReferralSchema.index({ ip: 1, userAgent: 1 });

export const deviceReferralModel = model<IDeviceReferral>("DeviceReferral", deviceReferralSchema);

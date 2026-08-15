import { Document } from "mongoose";

export interface IDeviceReferral extends Document {
  ip: string;
  userAgent: string;
  referralCode: string;
  createdAt: Date;
}

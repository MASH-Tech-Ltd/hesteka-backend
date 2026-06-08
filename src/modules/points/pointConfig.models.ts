import mongoose, { Model, Schema } from "mongoose";
import { IPointConfig } from "./pointConfig.interface";

const pointConfigSchema = new Schema<IPointConfig>(
  {
    pointsPerReport: {
      type: Number,
      default: 10,
    },
    pointsPerMission: {
      type: Number,
      default: 0,
    },
    pointsPerDonation: {
      type: Number,
      default: 15,
    },
    validityMonths: {
      type: Number,
      default: 12,
    },
    monthlyCeiling: {
      type: Number,
      default: 500,
    },
    isDoublePointsActive: {
      type: Boolean,
      default: false,
    },
    promotionStartTime: {
      type: Date,
      default: null,
    },
    promotionEndTime: {
      type: Date,
      default: null,
    },
    isPointsOnDonationsActive: {
      type: Boolean,
      default: true,
    },
    isValidityDurationActive: {
      type: Boolean,
      default: true,
    },
    isMonthlyCeilingActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// We only ever want one config document
export const pointConfigModel: Model<IPointConfig> = mongoose.model<IPointConfig>(
  "PointConfig",
  pointConfigSchema
);
